import { Env, Handler, InternalHandler, Message } from '@owallet/router';
import {
  getBase58Address,
  getAddressFromBech32,
  bufferToHex
} from '@owallet/common';
import {
  CreateMnemonicKeyMsg,
  CreatePrivateKeyMsg,
  GetKeyMsg,
  UnlockKeyRingMsg,
  RequestSignAminoMsg,
  RequestSignDirectMsg,
  LockKeyRingMsg,
  DeleteKeyRingMsg,
  UpdateNameKeyRingMsg,
  ShowKeyRingMsg,
  AddMnemonicKeyMsg,
  AddPrivateKeyMsg,
  GetMultiKeyStoreInfoMsg,
  ChangeKeyRingMsg,
  AddLedgerKeyMsg,
  CreateLedgerKeyMsg,
  SetKeyStoreCoinTypeMsg,
  RestoreKeyRingMsg,
  GetIsKeyStoreCoinTypeSetMsg,
  CheckPasswordMsg,
  ExportKeyRingDatasMsg,
  RequestVerifyADR36AminoSignDoc,
  RequestSignEthereumMsg,
  RequestSignEthereumTypedDataMsg,
  RequestSignReEncryptDataMsg,
  RequestSignDecryptDataMsg,
  RequestPublicKeyMsg,
  ChangeChainMsg,
  RequestSignTronMsg,
  GetDefaultAddressTronMsg
} from './messages';
import { KeyRingService } from './service';
import { Bech32Address, cosmos } from '@owallet/cosmos';

import Long from 'long';
import { SignEthereumTypedDataObject } from './types';

export const getHandler: (service: KeyRingService) => Handler = (
  service: KeyRingService
) => {
  return (env: Env, msg: Message<unknown>) => {
    switch (msg.constructor) {
      case RestoreKeyRingMsg:
        return handleRestoreKeyRingMsg(service)(env, msg as RestoreKeyRingMsg);
      case DeleteKeyRingMsg:
        return handleDeleteKeyRingMsg(service)(env, msg as DeleteKeyRingMsg);
      case UpdateNameKeyRingMsg:
        return handleUpdateNameKeyRingMsg(service)(
          env,
          msg as UpdateNameKeyRingMsg
        );
      case ShowKeyRingMsg:
        return handleShowKeyRingMsg(service)(env, msg as ShowKeyRingMsg);
      case CreateMnemonicKeyMsg:
        return handleCreateMnemonicKeyMsg(service)(
          env,
          msg as CreateMnemonicKeyMsg
        );
      case AddMnemonicKeyMsg:
        return handleAddMnemonicKeyMsg(service)(env, msg as AddMnemonicKeyMsg);
      case CreatePrivateKeyMsg:
        return handleCreatePrivateKeyMsg(service)(
          env,
          msg as CreatePrivateKeyMsg
        );
      case AddPrivateKeyMsg:
        return handleAddPrivateKeyMsg(service)(env, msg as AddPrivateKeyMsg);
      case CreateLedgerKeyMsg:
        return handleCreateLedgerKeyMsg(service)(
          env,
          msg as CreateLedgerKeyMsg
        );
      case AddLedgerKeyMsg:
        return handleAddLedgerKeyMsg(service)(env, msg as AddLedgerKeyMsg);
      case LockKeyRingMsg:
        return handleLockKeyRingMsg(service)(env, msg as LockKeyRingMsg);
      case UnlockKeyRingMsg:
        return handleUnlockKeyRingMsg(service)(env, msg as UnlockKeyRingMsg);
      case GetKeyMsg:
        return handleGetKeyMsg(service)(env, msg as GetKeyMsg);
      case GetDefaultAddressTronMsg:
        return handleGetDefaultAddressMsg(service)(env, msg as any);
      case RequestSignAminoMsg:
        return handleRequestSignAminoMsg(service)(
          env,
          msg as RequestSignAminoMsg
        );
      case RequestVerifyADR36AminoSignDoc:
        return handleRequestVerifyADR36AminoSignDoc(service)(
          env,
          msg as RequestVerifyADR36AminoSignDoc
        );
      case RequestSignDirectMsg:
        return handleRequestSignDirectMsg(service)(
          env,
          msg as RequestSignDirectMsg
        );
      case RequestSignEthereumMsg:
        return handleRequestSignEthereumMsg(service)(
          env,
          msg as RequestSignEthereumMsg
        );
      case RequestSignTronMsg:
        return handleRequestSignTronMsg(service)(
          env,
          msg as RequestSignTronMsg
        );
      case RequestSignEthereumTypedDataMsg:
        return handleRequestSignEthereumTypedData(service)(
          env,
          msg as RequestSignEthereumTypedDataMsg
        );
      case RequestPublicKeyMsg:
        return handleRequestPublicKey(service)(env, msg as RequestPublicKeyMsg);
      case RequestSignDecryptDataMsg:
        return handleRequestSignDecryptionData(service)(
          env,
          msg as RequestSignDecryptDataMsg
        );
      // thang4
      case RequestSignReEncryptDataMsg:
        return handleRequestSignReEncryptData(service)(
          env,
          msg as RequestSignReEncryptDataMsg
        );
      case GetMultiKeyStoreInfoMsg:
        return handleGetMultiKeyStoreInfoMsg(service)(
          env,
          msg as GetMultiKeyStoreInfoMsg
        );
      case ChangeKeyRingMsg:
        return handleChangeKeyRingMsg(service)(env, msg as ChangeKeyRingMsg);
      case GetIsKeyStoreCoinTypeSetMsg:
        return handleGetIsKeyStoreCoinTypeSetMsg(service)(
          env,
          msg as GetIsKeyStoreCoinTypeSetMsg
        );
      case SetKeyStoreCoinTypeMsg:
        return handleSetKeyStoreCoinTypeMsg(service)(
          env,
          msg as SetKeyStoreCoinTypeMsg
        );
      case CheckPasswordMsg:
        return handleCheckPasswordMsg(service)(env, msg as CheckPasswordMsg);
      case ExportKeyRingDatasMsg:
        return handleExportKeyRingDatasMsg(service)(
          env,
          msg as ExportKeyRingDatasMsg
        );
      case ChangeChainMsg:
        return handleChangeChainMsg(service)(env, msg as ChangeChainMsg);
      default:
        throw new Error('Unknown msg type');
    }
  };
};

const handleRestoreKeyRingMsg: (
  service: KeyRingService
) => InternalHandler<RestoreKeyRingMsg> = (service) => {
  return async (_env, _msg) => {
    return await service.restore();
  };
};

const handleDeleteKeyRingMsg: (
  service: KeyRingService
) => InternalHandler<DeleteKeyRingMsg> = (service) => {
  return async (_, msg) => {
    return await service.deleteKeyRing(msg.index, msg.password);
  };
};

const handleUpdateNameKeyRingMsg: (
  service: KeyRingService
) => InternalHandler<UpdateNameKeyRingMsg> = (service) => {
  return async (_, msg) => {
    return await service.updateNameKeyRing(msg.index, msg.name);
  };
};

const handleShowKeyRingMsg: (
  service: KeyRingService
) => InternalHandler<ShowKeyRingMsg> = (service) => {
  return async (_, msg) => {
    return await service.showKeyRing(msg.index, msg.password);
  };
};

const handleCreateMnemonicKeyMsg: (
  service: KeyRingService
) => InternalHandler<CreateMnemonicKeyMsg> = (service) => {
  return async (_, msg) => {
    return await service.createMnemonicKey(
      msg.kdf,
      msg.mnemonic,
      msg.password,
      msg.meta,
      msg.bip44HDPath
    );
  };
};

const handleAddMnemonicKeyMsg: (
  service: KeyRingService
) => InternalHandler<AddMnemonicKeyMsg> = (service) => {
  return async (_, msg) => {
    return await service.addMnemonicKey(
      msg.kdf,
      msg.mnemonic,
      msg.meta,
      msg.bip44HDPath
    );
  };
};

const handleCreatePrivateKeyMsg: (
  service: KeyRingService
) => InternalHandler<CreatePrivateKeyMsg> = (service) => {
  return async (_, msg) => {
    return await service.createPrivateKey(
      msg.kdf,
      msg.privateKey,
      msg.password,
      msg.meta
    );
  };
};

const handleAddPrivateKeyMsg: (
  service: KeyRingService
) => InternalHandler<AddPrivateKeyMsg> = (service) => {
  return async (_, msg) => {
    return await service.addPrivateKey(msg.kdf, msg.privateKey, msg.meta);
  };
};

const handleCreateLedgerKeyMsg: (
  service: KeyRingService
) => InternalHandler<CreateLedgerKeyMsg> = (service) => {
  return async (env, msg) => {
    return await service.createLedgerKey(
      env,
      msg.kdf,
      msg.password,
      msg.meta,
      msg.bip44HDPath
    );
  };
};

const handleAddLedgerKeyMsg: (
  service: KeyRingService
) => InternalHandler<AddLedgerKeyMsg> = (service) => {
  return async (env, msg) => {
    const result = await service.addLedgerKey(
      env,
      msg.kdf,
      msg.meta,
      msg.bip44HDPath
    );
    console.log(result, 'result ???');
    return result;
  };
};

const handleLockKeyRingMsg: (
  service: KeyRingService
) => InternalHandler<LockKeyRingMsg> = (service) => {
  return () => {
    return {
      status: service.lock()
    };
  };
};

const handleUnlockKeyRingMsg: (
  service: KeyRingService
) => InternalHandler<UnlockKeyRingMsg> = (service) => {
  return async (_, msg) => {
    return {
      status: await service.unlock(msg.password)
    };
  };
};

const handleGetKeyMsg: (
  service: KeyRingService
) => InternalHandler<GetKeyMsg> = (service) => {
  return async (env, msg) => {
    await service.permissionService.checkOrGrantBasicAccessPermission(
      env,
      msg.chainId,
      msg.origin
    );

    const key = await service.getKey(msg.chainId);

    return {
      name: service.getKeyStoreMeta('name'),
      algo: 'secp256k1',
      pubKey: key.pubKey,
      address: key.address,
      bech32Address: new Bech32Address(key.address).toBech32(
        (await service.chainsService.getChainInfo(msg.chainId)).bech32Config
          .bech32PrefixAccAddr
      ),
      isNanoLedger: key.isNanoLedger
    };
  };
};

const handleGetDefaultAddressMsg: (
  service: KeyRingService
) => InternalHandler<GetDefaultAddressTronMsg> = (service) => {
  return async (_, msg) => {
    const key = await service.getKey(msg.chainId);
    return {
      name: service.getKeyStoreMeta('name'),
      type: Number(key.isNanoLedger),
      hex: bufferToHex(key.pubKey),
      base58: getBase58Address(
        getAddressFromBech32(
          new Bech32Address(key.address).toBech32(
            (await service.chainsService.getChainInfo(msg.chainId)).bech32Config
              .bech32PrefixAccAddr
          )
        )
      )
    };
  };
};

const handleRequestSignAminoMsg: (
  service: KeyRingService
) => InternalHandler<RequestSignAminoMsg> = (service) => {
  return async (env, msg) => {
    await service.permissionService.checkOrGrantBasicAccessPermission(
      env,
      msg.chainId,
      msg.origin
    );

    return await service.requestSignAmino(
      env,
      msg.origin,
      msg.chainId,
      msg.signer,
      msg.signDoc,
      msg.signOptions
    );
  };
};

const handleRequestVerifyADR36AminoSignDoc: (
  service: KeyRingService
) => InternalHandler<RequestVerifyADR36AminoSignDoc> = (service) => {
  return async (env, msg) => {
    await service.permissionService.checkOrGrantBasicAccessPermission(
      env,
      msg.chainId,
      msg.origin
    );

    return await service.verifyADR36AminoSignDoc(
      msg.chainId,
      msg.signer,
      msg.data,
      msg.signature
    );
  };
};

//goes here
const handleRequestSignDirectMsg: (
  service: KeyRingService
) => InternalHandler<RequestSignDirectMsg> = (service) => {
  return async (env, msg) => {
    await service.permissionService.checkOrGrantBasicAccessPermission(
      env,
      msg.chainId,
      msg.origin
    );

    const signDoc = cosmos.tx.v1beta1.SignDoc.create({
      bodyBytes: msg.signDoc.bodyBytes,
      authInfoBytes: msg.signDoc.authInfoBytes,
      chainId: msg.signDoc.chainId,
      accountNumber: msg.signDoc.accountNumber
        ? Long.fromString(msg.signDoc.accountNumber)
        : undefined
    });

    const response = await service.requestSignDirect(
      env,
      msg.origin,
      msg.chainId,
      msg.signer,
      signDoc,
      msg.signOptions
    );

    return {
      signed: {
        bodyBytes: response.signed.bodyBytes,
        authInfoBytes: response.signed.authInfoBytes,
        chainId: response.signed.chainId,
        accountNumber: response.signed.accountNumber.toString()
      },
      signature: response.signature
    };
  };
};

const handleRequestSignEthereumTypedData: (
  service: KeyRingService
) => InternalHandler<RequestSignEthereumTypedDataMsg> = (service) => {
  return async (env, msg) => {
    console.log('REACH HANDLE IN SIGN TYPED DATA');
    const response = await service.requestSignEthereumTypedData(
      env,
      msg.chainId,
      msg.data?.[0]
    );
    console.log(response, 'RESPONSE AFTER HANDLE SIGN TYPED DATA');
    return { result: JSON.stringify(response) };
  };
};

const handleRequestPublicKey: (
  service: KeyRingService
) => InternalHandler<RequestPublicKeyMsg> = (service) => {
  return async (env, msg) => {
    const response = await service.requestPublicKey(env, msg.chainId);
    console.log(response, 'RESPONSE HERE');
    return { result: JSON.stringify(response) };
  };
};

const handleRequestSignDecryptionData: (
  service: KeyRingService
) => InternalHandler<RequestSignDecryptDataMsg> = (service) => {
  return async (env, msg) => {
    const response = await service.requestSignDecryptData(
      env,
      msg.chainId,
      msg.data
    );
    console.log(response, 'RESPONSE SIGN HERE');
    return { result: JSON.stringify(response) };
  };
};

// thang5
const handleRequestSignReEncryptData: (
  service: KeyRingService
) => InternalHandler<RequestSignReEncryptDataMsg> = (service) => {
  return async (env, msg) => {
    const response = await service.requestSignReEncryptData(
      env,
      msg.chainId,
      msg.data
    );
    console.log(response, 'RESPONSE SIGN HERE');
    return { result: JSON.stringify(response) };
  };
};

const handleRequestSignEthereumMsg: (
  service: KeyRingService
) => InternalHandler<RequestSignEthereumMsg> = (service) => {
  return async (env, msg) => {
    // const signDoc = cosmos.tx.v1beta1.SignDoc.create({
    //   bodyBytes: msg.signDoc.bodyBytes,
    //   authInfoBytes: msg.signDoc.authInfoBytes,
    //   chainId: msg.signDoc.chainId,
    //   accountNumber: msg.signDoc.accountNumber
    //     ? Long.fromString(msg.signDoc.accountNumber)
    //     : undefined,
    // });

    await service.permissionService.checkOrGrantBasicAccessPermission(
      env,
      msg.chainId,
      msg.origin
    );

    const response = await service.requestSignEthereum(
      env,
      msg.chainId,
      msg.data
      // signDoc
    );

    return { rawTxHex: response };
  };
};

const handleRequestSignTronMsg: (
  service: KeyRingService
) => InternalHandler<RequestSignTronMsg> = (service) => {
  return async (env, msg) => {
    const response = await service.requestSignTron(env, msg.chainId, msg.data);
    return { ...response };
  };
};

const handleGetMultiKeyStoreInfoMsg: (
  service: KeyRingService
) => InternalHandler<GetMultiKeyStoreInfoMsg> = (service) => {
  return () => {
    return {
      multiKeyStoreInfo: service.getMultiKeyStoreInfo()
    };
  };
};

const handleChangeKeyRingMsg: (
  service: KeyRingService
) => InternalHandler<ChangeKeyRingMsg> = (service) => {
  return async (_, msg) => {
    return await service.changeKeyStoreFromMultiKeyStore(msg.index);
  };
};

const handleChangeChainMsg: (
  service: KeyRingService
) => InternalHandler<ChangeChainMsg> = (service) => {
  return async (_, msg) => {
    console.log('handleChangeChainMsg handler keyring', msg);
    return await service.changeChain(msg.chainInfos);
  };
};

const handleGetIsKeyStoreCoinTypeSetMsg: (
  service: KeyRingService
) => InternalHandler<GetIsKeyStoreCoinTypeSetMsg> = (service) => {
  return (_, msg) => {
    return service.getKeyStoreBIP44Selectables(msg.chainId, msg.paths);
  };
};

const handleSetKeyStoreCoinTypeMsg: (
  service: KeyRingService
) => InternalHandler<SetKeyStoreCoinTypeMsg> = (service) => {
  return async (_, msg) => {
    await service.setKeyStoreCoinType(msg.chainId, msg.coinType);
    return service.keyRingStatus;
  };
};

const handleCheckPasswordMsg: (
  service: KeyRingService
) => InternalHandler<CheckPasswordMsg> = (service) => {
  return (_, msg) => {
    return service.checkPassword(msg.password);
  };
};

const handleExportKeyRingDatasMsg: (
  service: KeyRingService
) => InternalHandler<ExportKeyRingDatasMsg> = (service) => {
  return async (_, msg) => {
    return await service.exportKeyRingDatas(msg.password);
  };
};
