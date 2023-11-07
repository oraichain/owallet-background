import {
  AppChainInfo,
  Bech32Config,
  ChainInfo,
  Currency,
  CW20Currency,
  ERC20Currency,
  Secret20Currency
} from '@owallet/types';

import Joi, { ObjectSchema } from 'joi';

export type ChainInfoWithEmbed = AppChainInfo & {
  embeded: boolean;
};

export const CurrencySchema = Joi.object<Currency>({
  coinDenom: Joi.string().required(),
  coinMinimalDenom: Joi.string().required(),
  coinDecimals: Joi.number().integer().min(0).max(18).required(),
  coinGeckoId: Joi.string(),
  coinImageUrl: Joi.string().uri()
});

export const CW20CurrencySchema = (CurrencySchema as ObjectSchema<CW20Currency>)
  .keys({
    type: Joi.string().equal('cw20').required(),
    contractAddress: Joi.string().required()
  })
  .custom((value: CW20Currency) => {
    if (value.coinMinimalDenom.startsWith(`${value.type}:${value.contractAddress}:`)) {
      return value;
    } else {
      return {
        ...value,
        coinMinimalDenom: `${value.type}:${value.contractAddress}:` + value.coinMinimalDenom
      };
    }
  });

export const ERC20CurrencySchema = (CurrencySchema as ObjectSchema<ERC20Currency>)
  .keys({
    type: Joi.string().equal('erc20').required(),
    contractAddress: Joi.string().required()
  })
  .custom((value: ERC20Currency) => {
    return value;
  });

export const Secret20CurrencySchema = (CurrencySchema as ObjectSchema<Secret20Currency>)
  .keys({
    type: Joi.string().equal('secret20').required(),
    contractAddress: Joi.string().required(),
    viewingKey: Joi.string().required()
  })
  .custom((value: Secret20Currency) => {
    if (value.coinMinimalDenom.startsWith(`${value.type}:${value.contractAddress}:`)) {
      return value;
    } else {
      return {
        ...value,
        coinMinimalDenom: `${value.type}:${value.contractAddress}:` + value.coinMinimalDenom
      };
    }
  });

export const Bech32ConfigSchema = Joi.object<Bech32Config>({
  bech32PrefixAccAddr: Joi.string().required(),
  bech32PrefixAccPub: Joi.string().required(),
  bech32PrefixValAddr: Joi.string().required(),
  bech32PrefixValPub: Joi.string().required(),
  bech32PrefixConsAddr: Joi.string().required(),
  bech32PrefixConsPub: Joi.string().required()
});

export const SuggestingBIP44Schema = Joi.object<{ coinType: number }>({
  coinType: Joi.number().integer().min(0).required()
  // Alow the any keys for compatibility of cosmosJS's BIP44 (for legacy).
}).unknown(true);

export const ChainInfoSchema = Joi.object<ChainInfo>({
  rpc: Joi.string().required().uri(),
  // TODO: Handle rpc config.
  rest: Joi.string().required().uri(),
  // TODO: Handle rest config.
  chainId: Joi.string().required().min(1).max(30),
  // networkType: Joi.string().required().valid('cosmos', 'evm'),
  chainName: Joi.string().required().min(1).max(30),
  stakeCurrency: CurrencySchema.required(),
  bip44: SuggestingBIP44Schema.required(),
  bech32Config: Bech32ConfigSchema.required(),
  currencies: Joi.array().min(1).items(CurrencySchema, CW20CurrencySchema, Secret20CurrencySchema).required(),
  feeCurrencies: Joi.array().min(1).items(CurrencySchema).required(),
  coinType: Joi.number().integer(),
  beta: Joi.boolean(),
  gasPriceStep: Joi.object({
    low: Joi.number().required(),
    average: Joi.number().required(),
    high: Joi.number().required()
  }),
  features: Joi.array()
    .items(Joi.string().valid('stargate', 'cosmwasm', 'secretwasm', 'ibc-transfer', 'no-legacy-stdTx', 'ibc-go'))
    .unique()
    .custom((value: string[]) => {
      if (value.indexOf('cosmwasm') >= 0 && value.indexOf('secretwasm') >= 0) {
        throw new Error('cosmwasm and secretwasm are not compatible');
      }

      return value;
    })
});

export type ChainInfoWithRepoUpdateOptions = ChainInfo & {
  updateFromRepoDisabled?: boolean;
};

export type ChainInfoWithCoreTypes = ChainInfo & {
  embeded: boolean;
} & ChainInfoWithRepoUpdateOptions;
