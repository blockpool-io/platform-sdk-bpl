import { Contracts } from "@arkecosystem/platform-sdk";

import { TransactionData } from "../transaction";

export class TransferData extends TransactionData implements Contracts.TransferData {
	public memo(): string | undefined {
		return this.data.vendorField;
	}
}
