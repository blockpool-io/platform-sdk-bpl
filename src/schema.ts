import { ValidatorSchema } from "@arkecosystem/platform-sdk-support";

export const schema: any = ValidatorSchema.object({
	network: ValidatorSchema.string().valid("bpl.mainnet", "bpl.testnet"),
	peer: ValidatorSchema.string().uri(),
	peerMultiSignature: ValidatorSchema.string().uri(),
	httpClient: ValidatorSchema.object(),
	services: ValidatorSchema.object({
		ledger: ValidatorSchema.object({
			transport: ValidatorSchema.any(),
		}),
	}).default(undefined),
});
