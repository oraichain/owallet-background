import { delay, inject, singleton } from 'tsyringe';
import { TYPES } from '../types';

import { Key, KeyRing, KeyRingStatus, MultiKeyStoreInfoWithSelected } from './keyring';

import {
  Bech32Address,
  checkAndValidateADR36AminoSignDoc,
  makeADR36AminoSignDoc,
  verifyADR36AminoSignDoc
} from '@owallet/cosmos';
import {
  AddressesLedger,
  CommonCrypto,
  ECDSASignature,
  ExportKeyRingData,
  MessageTypes,
  PubkeyLedger,
  SignEthereumTypedDataObject,
  SignTypedDataVersion,
  TypedMessage
} from './types';
import TronWeb from 'tronweb';

import {
  KVStore,
  fetchAdapter,
  EVMOS_NETWORKS,
  MyBigInt,
  getChainInfoOrThrow,
  isEthermintLike,
  escapeHTML,
  sortObjectByKey
} from '@owallet/common';
import { ChainsService } from '../chains';
import { LedgerService } from '../ledger';
import { BIP44, ChainInfo, OWalletSignOptions, StdSignDoc, BIP44HDPath } from '@owallet/types';
import { APP_PORT, Env, OWalletError, WEBPAGE_PORT } from '@owallet/router';
import { InteractionService } from '../interaction';
import { PermissionService } from '../permission';
import { SignDoc } from '@owallet/proto-types/cosmos/tx/v1beta1/tx';
import { encodeSecp256k1Signature, serializeSignDoc, AminoSignResponse, StdSignature } from '@cosmjs/launchpad';

import { DirectSignResponse, makeSignBytes } from '@cosmjs/proto-signing';
import { RNG } from '@owallet/crypto';
import { encodeSecp256k1Pubkey } from '@owallet/cosmos';
import { Buffer } from 'buffer/';
import { request } from '../tx';
import { Dec, DecUtils } from '@owallet/unit';
import { trimAminoSignDoc } from './amino-sign-doc';
import { KeyringHelper } from './utils';
@singleton()
export class KeyRingService {
  private readonly keyRing: KeyRing;

  constructor(
    @inject(TYPES.KeyRingStore)
    kvStore: KVStore,
    @inject(TYPES.ChainsEmbedChainInfos)
    embedChainInfos: ChainInfo[],
    @inject(delay(() => InteractionService))
    protected readonly interactionService: InteractionService,
    @inject(delay(() => ChainsService))
    public readonly chainsService: ChainsService,
    @inject(delay(() => PermissionService))
    public readonly permissionService: PermissionService,
    @inject(LedgerService)
    ledgerService: LedgerService,
    @inject(TYPES.RNG)
    protected readonly rng: RNG,
    @inject(TYPES.CommonCrypto)
    protected readonly crypto: CommonCrypto
  ) {
    this.keyRing = new KeyRing(embedChainInfos, kvStore, ledgerService, rng, crypto);
  }

  async restore(): Promise<{
    status: KeyRingStatus;
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
  }> {
    await this.keyRing.restore();
    return {
      status: this.keyRing.status,
      multiKeyStoreInfo: this.keyRing.getMultiKeyStoreInfo()
    };
  }

  async enable(env: Env): Promise<KeyRingStatus> {
    if (this.keyRing.status === KeyRingStatus.EMPTY) {
      throw new OWalletError('keyring', 261, "key doesn't exist");
    }

    if (this.keyRing.status === KeyRingStatus.NOTLOADED) {
      await this.keyRing.restore();
    }

    if (this.keyRing.status === KeyRingStatus.LOCKED) {
      await this.interactionService.waitApprove(env, '/unlock', 'unlock', {});
      return this.keyRing.status;
    }

    return this.keyRing.status;
  }

  get keyRingStatus(): KeyRingStatus {
    return this.keyRing.status;
  }

  async deleteKeyRing(
    index: number,
    password: string
  ): Promise<{
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
    status: KeyRingStatus;
  }> {
    let keyStoreChanged = false;

    try {
      const result = await this.keyRing.deleteKeyRing(index, password);
      keyStoreChanged = result.keyStoreChanged;
      return {
        multiKeyStoreInfo: result.multiKeyStoreInfo,
        status: this.keyRing.status
      };
    } finally {
      if (keyStoreChanged) {
        this.interactionService.dispatchEvent(WEBPAGE_PORT, 'keystore-changed', {});
      }
    }
  }

  async requestSignProxyDecryptionData(env: Env, chainId: string, data: object): Promise<object> {
    console.log('in request sign proxy decryption data: ', chainId);

    try {
      const rpc = await this.chainsService.getChainInfo(chainId);
      const rpcCustom = EVMOS_NETWORKS.includes(chainId) ? rpc.evmRpc : rpc.rest;
      const newData = await this.estimateFeeAndWaitApprove(env, chainId, rpcCustom, data);
      const rawTxHex = await this.keyRing.signProxyDecryptionData(chainId, newData);

      return rawTxHex;
    } catch (e) {
      console.log('e', e.message);
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-ethereum-end', {});
    }
  }

  async requestSignProxyReEncryptionData(env: Env, chainId: string, data: object): Promise<object> {
    console.log('in request sign proxy re-encryption data: ', chainId);

    try {
      const rpc = await this.chainsService.getChainInfo(chainId);
      const rpcCustom = EVMOS_NETWORKS.includes(chainId) ? rpc.evmRpc : rpc.rest;
      const newData = await this.estimateFeeAndWaitApprove(env, chainId, rpcCustom, data);
      const rawTxHex = await this.keyRing.signProxyReEncryptionData(chainId, newData);

      return rawTxHex;
    } catch (e) {
      console.log('e', e.message);
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-ethereum-end', {});
    }
  }

  async updateNameKeyRing(
    index: number,
    name: string,
    email?: string
  ): Promise<{
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
  }> {
    const multiKeyStoreInfo = await this.keyRing.updateNameKeyRing(index, name, email);
    return {
      multiKeyStoreInfo
    };
  }

  async showKeyRing(index: number, password: string): Promise<string> {
    return await this.keyRing.showKeyRing(index, password);
  }

  async createMnemonicKey(
    kdf: 'scrypt' | 'sha256' | 'pbkdf2',
    mnemonic: string,
    password: string,
    meta: Record<string, string>,
    bip44HDPath: BIP44HDPath
  ): Promise<{
    status: KeyRingStatus;
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
  }> {
    // TODO: Check mnemonic checksum.
    return await this.keyRing.createMnemonicKey(kdf, mnemonic, password, meta, bip44HDPath);
  }

  async createPrivateKey(
    kdf: 'scrypt' | 'sha256' | 'pbkdf2',
    privateKey: Uint8Array,
    password: string,
    meta: Record<string, string>
  ): Promise<{
    status: KeyRingStatus;
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
  }> {
    return await this.keyRing.createPrivateKey(kdf, privateKey, password, meta);
  }

  async createLedgerKey(
    env: Env,
    kdf: 'scrypt' | 'sha256' | 'pbkdf2',
    password: string,
    meta: Record<string, string>,
    bip44HDPath: BIP44HDPath
  ): Promise<{
    status: KeyRingStatus;
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
  }> {
    return await this.keyRing.createLedgerKey(env, kdf, password, meta, bip44HDPath);
  }

  lock(): KeyRingStatus {
    this.keyRing.lock();
    return this.keyRing.status;
  }

  async unlock(password: string, saving: boolean): Promise<KeyRingStatus> {
    await this.keyRing.unlock(password, saving);

    return this.keyRing.status;
  }

  async getKey(chainIdOrCoinType: string | number): Promise<Key> {
    // if getKey directly from cointype as number
    if (typeof chainIdOrCoinType === 'number') {
      return this.keyRing.getKeyFromCoinType(chainIdOrCoinType);
    }
    return this.keyRing.getKey(chainIdOrCoinType, await this.chainsService.getChainCoinType(chainIdOrCoinType));
  }

  getKeyStoreMeta(key: string): string {
    return this.keyRing.getKeyStoreMeta(key);
  }

  getKeyRingType(): string {
    return this.keyRing.type;
  }

  getKeyRingLedgerAddresses(): AddressesLedger {
    return this.keyRing.addresses;
  }
  getKeyRingLedgerPubKey(): PubkeyLedger {
    return this.keyRing.pubkeys;
  }
  async requestSignEIP712CosmosTx_v0_selected(
    env: Env,
    origin: string,
    chainId: string,
    signer: string,
    eip712: {
      types: Record<string, { name: string; type: string }[] | undefined>;
      domain: Record<string, any>;
      primaryType: string;
    },
    signDoc: StdSignDoc,
    signOptions: OWalletSignOptions
  ): Promise<AminoSignResponse> {
    return this.requestSignEIP712CosmosTx_v0(env, origin, chainId, signer, eip712, signDoc, signOptions);
  }
  processSignDocEIP712(signDoc: StdSignDoc, chainId: string, signer: string, keyInfo: Key) {
    const isEthermint = KeyringHelper.isEthermintByChainId(chainId);
    if (!isEthermint) {
      throw new Error('This feature is only usable on cosmos-sdk evm chain');
    }

    if (!keyInfo.isNanoLedger) {
      throw new Error('This feature is only usable on ledger ethereum app');
    }
    const bech32Prefix = getChainInfoOrThrow(chainId).bech32Config.bech32PrefixAccAddr;
    const bech32Address = new Bech32Address(keyInfo.address).toBech32(bech32Prefix);
    if (signer !== bech32Address) {
      throw new Error('Signer mismatched');
    }
    signDoc = {
      ...signDoc,
      memo: escapeHTML(signDoc.memo)
    };
    signDoc = trimAminoSignDoc(signDoc);
    const sortSignDoc = sortObjectByKey(signDoc);
    return sortSignDoc;
  }
  async requestSignEIP712CosmosTx_v0(
    env: Env,
    origin: string,
    chainId: string,
    signer: string,
    eip712: {
      types: Record<string, { name: string; type: string }[] | undefined>;
      domain: Record<string, any>;
      primaryType: string;
    },
    signDoc: StdSignDoc,
    signOptions: OWalletSignOptions
  ): Promise<AminoSignResponse> {
    const coinType = await this.chainsService.getChainCoinType(chainId);
    const keyInfo = this.keyRing.getKey(chainId, coinType);
    if (!keyInfo) {
      throw new Error('Null key info');
    }
    signDoc = this.processSignDocEIP712(signDoc, chainId, signer, keyInfo);

    let newSignDoc = (await this.interactionService.waitApprove(env, '/sign', 'request-sign', {
      msgOrigin: origin,
      chainId,
      mode: 'amino',
      signDoc,
      signer,
      signOptions,
      pubKey: keyInfo.pubKey,
      eip712,
      keyType: this.getKeyRingType()
    })) as StdSignDoc;

    newSignDoc = {
      ...newSignDoc,
      memo: escapeHTML(newSignDoc.memo)
    };
    try {
      // const signature = null;
      const signature = await this.keyRing.sign(
        env,
        chainId,
        coinType,
        serializeSignDoc({
          ...newSignDoc,
          eip712
        } as any)
      );

      return {
        signed: newSignDoc,
        signature: {
          pub_key: encodeSecp256k1Pubkey(keyInfo.pubKey),
          // Return eth signature (r | s | v) 65 bytes.
          signature: Buffer.from(signature).toString('base64')
        }
      };
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-end', {});
    }
  }
  async requestSignAmino(
    env: Env,
    msgOrigin: string,
    chainId: string,
    signer: string,
    signDoc: StdSignDoc,
    signOptions: OWalletSignOptions & {
      // Hack option field to detect the sign arbitrary for string
      isADR36WithString?: boolean;
    }
  ): Promise<AminoSignResponse> {
    const coinType = await this.chainsService.getChainCoinType(chainId);

    const key = this.keyRing.getKey(chainId, coinType);
    const bech32Prefix = (await this.chainsService.getChainInfo(chainId)).bech32Config.bech32PrefixAccAddr;
    const bech32Address = new Bech32Address(key.address).toBech32(bech32Prefix);
    if (signer !== bech32Address) {
      throw new Error('Signer mismatched');
    }

    const isADR36SignDoc = checkAndValidateADR36AminoSignDoc(signDoc, bech32Prefix);
    if (isADR36SignDoc) {
      if (signDoc.msgs[0].value.signer !== signer) {
        throw new OWalletError('keyring', 233, 'Unmatched signer in sign doc');
      }
    }

    if (signOptions.isADR36WithString != null && !isADR36SignDoc) {
      throw new OWalletError('keyring', 236, 'Sign doc is not for ADR-36. But, "isADR36WithString" option is defined');
    }

    const newSignDoc = (await this.interactionService.waitApprove(env, '/sign', 'request-sign', {
      msgOrigin,
      chainId,
      mode: 'amino',
      signDoc,
      signer,
      signOptions,
      isADR36SignDoc,
      isADR36WithString: signOptions.isADR36WithString
    })) as StdSignDoc;

    if (isADR36SignDoc) {
      // Validate the new sign doc, if it was for ADR-36.
      if (checkAndValidateADR36AminoSignDoc(signDoc, bech32Prefix)) {
        if (signDoc.msgs[0].value.signer !== signer) {
          throw new OWalletError('keyring', 232, 'Unmatched signer in new sign doc');
        }
      } else {
        throw new OWalletError(
          'keyring',
          237,
          'Signing request was for ADR-36. But, accidentally, new sign doc is not for ADR-36'
        );
      }
    }

    try {
      const signature = await this.keyRing.sign(env, chainId, coinType, serializeSignDoc(newSignDoc));

      return {
        signed: newSignDoc,
        signature: encodeSecp256k1Signature(key.pubKey, signature)
      };
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-end', {});
    }
  }

  async requestSignDirect(
    env: Env,
    msgOrigin: string,
    chainId: string,
    signer: string,
    signDoc: SignDoc,
    signOptions: OWalletSignOptions
  ): Promise<DirectSignResponse> {
    const coinType = await this.chainsService.getChainCoinType(chainId);

    // sign get here
    const key = this.keyRing.getKey(chainId, coinType);
    const bech32Address = new Bech32Address(key.address).toBech32(
      (await this.chainsService.getChainInfo(chainId)).bech32Config.bech32PrefixAccAddr
    );
    if (signer !== bech32Address) {
      throw new Error('Signer mismatched');
    }

    const newSignDocBytes = (await this.interactionService.waitApprove(env, '/sign', 'request-sign', {
      msgOrigin,
      chainId,
      mode: 'direct',
      signDocBytes: SignDoc.encode(signDoc).finish(),
      signer,
      signOptions
    })) as Uint8Array;

    const newSignDoc = SignDoc.decode(newSignDocBytes);

    try {
      const signature = await this.keyRing.sign(env, chainId, coinType, makeSignBytes(newSignDoc));

      return {
        signed: newSignDoc,
        signature: encodeSecp256k1Signature(key.pubKey, signature)
      };
    } catch (e) {
      console.log('e', e.message);
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-end', {});
    }
  }

  async requestSignEthereum(env: Env, chainId: string, data: object): Promise<string> {
    const coinType = await this.chainsService.getChainCoinType(chainId);
    const rpc = await this.chainsService.getChainInfo(chainId);
    const rpcCustom = EVMOS_NETWORKS.includes(chainId) ? rpc.evmRpc : rpc.rest;
    // TODO: add UI here so users can change gas, memo & fee
    const newData = await this.estimateFeeAndWaitApprove(env, chainId, rpcCustom, data);

    // Need to check ledger here and ledger app type by chainId
    try {
      const rawTxHex = await this.keyRing.signAndBroadcastEthereum(env, chainId, coinType, rpcCustom, newData);

      return rawTxHex;
    } catch (error) {
      console.log({ error });
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-ethereum-end', {});
    }
  }
  async requestSignBitcoin(
    env: Env,
    chainId: string,
    data: object
  ): Promise<string> {
    // here
    const newData = (await this.interactionService.waitApprove(
      env,
      '/sign-bitcoin',
      'request-sign-bitcoin',
      data
    )) as any;
    console.log(newData, 'NEW DATA IN BITCOIN');

    // Need to check ledger here and ledger app type by chainId
    try {
      const txHash = await this.keyRing.signAndBroadcastBitcoin(
        env,
        chainId,
        newData
      );
      return txHash;
    } catch (error) {
      console.log('🚀 ~ file: service.ts:547 ~ KeyRingService ~ error:', error);
      console.log({ error });
      throw error;
    } finally {
      this.interactionService.dispatchEvent(
        APP_PORT,
        'request-sign-bitcoin-end',
        {}
      );
    }
  }

  async requestSignEthereumTypedData(
    env: Env,
    chainId: string,
    data: SignEthereumTypedDataObject
  ): Promise<ECDSASignature> {
    try {
      const rawTxHex = await this.keyRing.signEthereumTypedData({
        typedMessage: data.typedMessage,
        version: data.version,
        chainId,
        defaultCoinType: data.defaultCoinType
      });

      return rawTxHex;
    } catch (e) {
      console.log('e', e.message);
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-end', {});
    }
  }

  async requestPublicKey(env: Env, chainId: string): Promise<string> {
    try {
      const rawTxHex = await this.keyRing.getPublicKey(chainId);

      return rawTxHex;
    } catch (e) {
      console.log('e', e.message);
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-ethereum-end', {});
    }
  }

  async requestSignDecryptData(env: Env, chainId: string, data: object): Promise<object> {
    try {
      const rpc = await this.chainsService.getChainInfo(chainId);
      const rpcCustom = EVMOS_NETWORKS.includes(chainId) ? rpc.evmRpc : rpc.rest;
      const newData = await this.estimateFeeAndWaitApprove(env, chainId, rpcCustom, data);
      const rawTxHex = await this.keyRing.signDecryptData(chainId, newData);
      return rawTxHex;
    } catch (e) {
      console.log('e', e.message);
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-ethereum-end', {});
    }
  }

  async requestSignReEncryptData(env: Env, chainId: string, data: object): Promise<object> {
    try {
      const rpc = await this.chainsService.getChainInfo(chainId);
      const rpcCustom = EVMOS_NETWORKS.includes(chainId) ? rpc.evmRpc : rpc.rest;
      const newData = await this.estimateFeeAndWaitApprove(env, chainId, rpcCustom, data);
      const rawTxHex = await this.keyRing.signReEncryptData(chainId, newData);

      return rawTxHex;
    } catch (e) {
      console.log('e', e.message);
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-ethereum-end', {});
    }
  }

  async setKeyStoreLedgerAddress(env: Env, bip44HDPath: string, chainId: string | number): Promise<void> {
    await this.keyRing.setKeyStoreLedgerAddress(env, bip44HDPath, chainId);

    this.interactionService.dispatchEvent(WEBPAGE_PORT, 'keystore-changed', {});
  }

  async estimateFeeAndWaitApprove(env: Env, chainId: string, rpc: string, data: object): Promise<object> {
    const decimals = (await this.chainsService.getChainInfo(chainId)).feeCurrencies?.[0].coinDecimals;
    const estimatedGasPrice = await request(rpc, 'eth_gasPrice', []);
    let estimatedGasLimit = '0x5028';
    try {
      estimatedGasLimit = await request(rpc, 'eth_estimateGas', [
        {
          ...data,
          maxFeePerGas: undefined,
          maxPriorityFeePerGas: undefined
        }
      ]);
    } catch (error) {
      console.log('🚀 ~ file: service.ts ~ line 396 ~ KeyRingService ~ error', error);
    }

    const approveData = (await this.interactionService.waitApprove(env, '/sign-ethereum', 'request-sign-ethereum', {
      env,
      chainId,
      mode: 'direct',
      data: {
        ...data,
        estimatedGasPrice: (data as any)?.gasPrice || estimatedGasPrice,
        estimatedGasLimit: (data as any)?.gas || estimatedGasLimit,
        decimals
      }
    })) as any;

    const { gasPrice, gasLimit, memo, fees } = {
      gasPrice: approveData.gasPrice ?? '0x0',
      memo: approveData.memo ?? '',
      gasLimit: approveData.gasLimit,
      fees: approveData.fees
    };

    return { ...data, gasPrice, gasLimit, memo, fees };
  }

  async verifyADR36AminoSignDoc(
    chainId: string,
    signer: string,
    data: Uint8Array,
    signature: StdSignature
  ): Promise<boolean> {
    const coinType = await this.chainsService.getChainCoinType(chainId);

    const key = this.keyRing.getKey(chainId, coinType);
    const bech32Prefix = (await this.chainsService.getChainInfo(chainId)).bech32Config.bech32PrefixAccAddr;
    const bech32Address = new Bech32Address(key.address).toBech32(bech32Prefix);
    if (signer !== bech32Address) {
      throw new Error('Signer mismatched');
    }
    if (signature.pub_key.type !== 'tendermint/PubKeySecp256k1') {
      throw new Error(`Unsupported type of pub key: ${signature.pub_key.type}`);
    }
    if (Buffer.from(key.pubKey).toString('base64') !== signature.pub_key.value) {
      throw new Error('Pub key unmatched');
    }

    const signDoc = makeADR36AminoSignDoc(signer, data);

    return verifyADR36AminoSignDoc(
      bech32Prefix,
      signDoc,
      Buffer.from(signature.pub_key.value, 'base64'),
      Buffer.from(signature.signature, 'base64')
    );
  }

  // here
  async sign(env: Env, chainId: string, message: Uint8Array): Promise<Uint8Array> {
    return this.keyRing.sign(env, chainId, await this.chainsService.getChainCoinType(chainId), message);
  }

  async addMnemonicKey(
    kdf: 'scrypt' | 'sha256' | 'pbkdf2',
    mnemonic: string,
    meta: Record<string, string>,
    bip44HDPath: BIP44HDPath
  ): Promise<{
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
  }> {
    return this.keyRing.addMnemonicKey(kdf, mnemonic, meta, bip44HDPath);
  }

  async addPrivateKey(
    kdf: 'scrypt' | 'sha256' | 'pbkdf2',
    privateKey: Uint8Array,
    meta: Record<string, string>
  ): Promise<{
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
  }> {
    return this.keyRing.addPrivateKey(kdf, privateKey, meta);
  }

  async addLedgerKey(
    env: Env,
    kdf: 'scrypt' | 'sha256' | 'pbkdf2',
    meta: Record<string, string>,
    bip44HDPath: BIP44HDPath
  ): Promise<{
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
  }> {
    return this.keyRing.addLedgerKey(env, kdf, meta, bip44HDPath);
  }

  public async changeKeyStoreFromMultiKeyStore(index: number): Promise<{
    multiKeyStoreInfo: MultiKeyStoreInfoWithSelected;
  }> {
    try {
      return await this.keyRing.changeKeyStoreFromMultiKeyStore(index);
    } finally {
      this.interactionService.dispatchEvent(WEBPAGE_PORT, 'keystore-changed', {});
    }
  }

  public async changeChain(chainInfos: object = {}): Promise<void | any> {
    this.interactionService.dispatchEvent(WEBPAGE_PORT, 'keystore-changed', {
      ...chainInfos
    });
  }

  public checkPassword(password: string): boolean {
    return this.keyRing.checkPassword(password);
  }

  getMultiKeyStoreInfo(): MultiKeyStoreInfoWithSelected {
    return this.keyRing.getMultiKeyStoreInfo();
  }

  isKeyStoreCoinTypeSet(chainId: string): boolean {
    return this.keyRing.isKeyStoreCoinTypeSet(chainId);
  }

  async setKeyStoreCoinType(chainId: string, coinType: number): Promise<void> {
    const prevCoinType = this.keyRing.computeKeyStoreCoinType(
      chainId,
      await this.chainsService.getChainCoinType(chainId)
    );

    await this.keyRing.setKeyStoreCoinType(chainId, coinType);

    if (prevCoinType !== coinType) {
      this.interactionService.dispatchEvent(WEBPAGE_PORT, 'keystore-changed', {});
    }
  }

  async getKeyStoreBIP44Selectables(
    chainId: string,
    paths: BIP44[]
  ): Promise<{ readonly path: BIP44; readonly bech32Address: string }[]> {
    if (this.isKeyStoreCoinTypeSet(chainId)) {
      return [];
    }

    const result = [];
    const chainInfo = await this.chainsService.getChainInfo(chainId);

    for (const path of paths) {
      const key = this.keyRing.getKeyFromCoinType(path.coinType);
      const bech32Address = new Bech32Address(key.address).toBech32(chainInfo.bech32Config.bech32PrefixAccAddr);

      result.push({
        path,
        bech32Address
      });
    }

    return result;
  }

  async exportKeyRingDatas(password: string): Promise<ExportKeyRingData[]> {
    return await this.keyRing.exportKeyRingDatas(password);
  }

  async requestSignTron(env: Env, chainId: string, data: object): Promise<object> {
    const newData = (await this.interactionService.waitApprove(env, '/sign-tron', 'request-sign-tron', data)) as any;
    try {
      if (newData?.txID) {
        newData.signature = [Buffer.from(await this.keyRing.sign(env, chainId, 195, newData.txID)).toString('hex')];
        return newData;
      }

      const tronWeb = new TronWeb({
        fullHost: (await this.chainsService.getChainInfo(chainId)).rpc
      });
      tronWeb.fullNode.instance.defaults.adapter = fetchAdapter;
      let transaction: any;
      if (newData?.tokenTrc20) {
        const amount = new MyBigInt(Math.trunc(newData?.amount * Math.pow(10, 6)));

        transaction = (
          await tronWeb.transactionBuilder.triggerSmartContract(
            newData.tokenTrc20.contractAddress,
            'transfer(address,uint256)',
            {
              callValue: 0,
              userFeePercentage: 100,
              shouldPollResponse: false
            },
            [
              { type: 'address', value: newData.recipient },
              { type: 'uint256', value: amount.toString() }
            ],
            newData.address
          )
        ).transaction;
      } else {
        // get address here from keyring and
        transaction = await tronWeb.transactionBuilder.sendTrx(
          newData.recipient,
          new Dec(Number((newData.amount ?? '0').replace(/,/g, '.'))).mul(DecUtils.getTenExponentNInPrecisionRange(6)),
          newData.address
        );
      }

      // const transactionData = Buffer.from(transaction.raw_data_hex, 'hex');

      transaction.signature = [
        Buffer.from(await this.keyRing.sign(env, chainId, 195, transaction?.txID)).toString('hex')
      ];

      const receipt = await tronWeb.trx.sendRawTransaction(transaction);
      return receipt.txid ?? receipt.transaction.raw_data_hex;
    } finally {
      this.interactionService.dispatchEvent(APP_PORT, 'request-sign-tron-end', {});
    }
  }
}
