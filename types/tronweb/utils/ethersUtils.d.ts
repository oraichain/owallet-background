export const keccak256: typeof utils.keccak256;
export const sha256: typeof utils.sha256;
export const toUtf8Bytes: typeof utils.toUtf8Bytes;
export const toUtf8String: typeof utils.toUtf8String;
export const recoverAddress: typeof utils.recoverAddress;
export const SigningKey: typeof utils.SigningKey;
export const AbiCoder: typeof utils.AbiCoder;
export const Interface: typeof utils.Interface;
export const FormatTypes: {
  [name: string]: string;
};
export const splitSignature: typeof utils.splitSignature;
export const joinSignature: typeof utils.joinSignature;
export const arrayify: typeof utils.arrayify;
import { Wallet as ethersWallet } from 'ethers';
export const concat: typeof utils.concat;
export const id: typeof utils.id;
// export const isValidMnemonic: typeof utils.isValidMnemonic;
import { utils } from 'ethers';
export { ethersWallet };
