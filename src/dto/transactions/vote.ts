import { Contracts } from "@arkecosystem/platform-sdk";

import { TransactionData } from "../transaction";

export class VoteData extends TransactionData implements Contracts.VoteData {
	public votes(): string[] {
		return this.data.asset.votes
			.filter((vote: string) => vote.startsWith("+"))
			.map((publicKey: string) => publicKey.substr(1));
	}

	public unvotes(): string[] {
		return this.data.asset.votes
			.filter((vote: string) => vote.startsWith("-"))
			.map((publicKey: string) => publicKey.substr(1));
	}
}
