import { PendingMultiSignatureTransaction } from "@arkecosystem/multi-signature";
import { Coins, Contracts } from "@arkecosystem/platform-sdk";
import { Arr } from "@arkecosystem/platform-sdk-support";

/** @inheritdoc */
export class MultiSignatureService implements Contracts.MultiSignatureService {
	/**
	 * The configuration of the current instance.
	 *
	 * @type {Coins.Config}
	 * @memberof MultiSignatureService
	 */
	readonly #config: Coins.Config;

	/**
	 * The HTTP client of the current instance.
	 *
	 * @type {Contracts.HttpClient}
	 * @memberof MultiSignatureService
	 */
	readonly #http: Contracts.HttpClient;

	/**
	 * Creates an instance of MultiSignatureService.
	 *
	 * @param {Coins.Config} config
	 * @memberof MultiSignatureService
	 */
	private constructor(config: Coins.Config) {
		this.#config = config;
		this.#http = config.get<Contracts.HttpClient>("httpClient");
	}

	/** @inheritdoc */
	public static async __construct(config: Coins.Config): Promise<MultiSignatureService> {
		return new MultiSignatureService(config);
	}

	/** @inheritdoc */
	public async __destruct(): Promise<void> {
		//
	}

	/** @inheritdoc */
	public async allWithPendingState(publicKey: string): Promise<Contracts.MultiSignatureTransaction[]> {
		return this.fetchAll(publicKey, "pending");
	}

	/** @inheritdoc */
	public async allWithReadyState(publicKey: string): Promise<Contracts.MultiSignatureTransaction[]> {
		return this.fetchAll(publicKey, "ready");
	}

	/** @inheritdoc */
	public async findById(id: string): Promise<Contracts.MultiSignatureTransaction> {
		return this.normalizeTransaction(await this.get(`transaction/${id}`));
	}

	/** @inheritdoc */
	public async broadcast(transaction: Contracts.MultiSignatureTransaction): Promise<string> {
		let multiSignature = transaction.multiSignature;

		if (transaction.asset && transaction.asset.multiSignature) {
			multiSignature = transaction.asset.multiSignature;
		}

		const { id } = await this.post("transaction", {
			data: transaction,
			multisigAsset: multiSignature,
		});

		return id;
	}

	/** @inheritdoc */
	public async flush(): Promise<Contracts.MultiSignatureTransaction> {
		return this.delete("transactions");
	}

	/** @inheritdoc */
	public isMultiSignatureReady(transaction: Contracts.SignedTransactionData, excludeFinal?: boolean): boolean {
		return new PendingMultiSignatureTransaction(transaction.data()).isMultiSignatureReady({ excludeFinal });
	}

	/** @inheritdoc */
	public needsSignatures(transaction: Contracts.SignedTransactionData): boolean {
		return new PendingMultiSignatureTransaction(transaction.data()).needsSignatures();
	}

	/** @inheritdoc */
	public needsAllSignatures(transaction: Contracts.SignedTransactionData): boolean {
		return new PendingMultiSignatureTransaction(transaction.data()).needsAllSignatures();
	}

	/** @inheritdoc */
	public needsWalletSignature(transaction: Contracts.SignedTransactionData, publicKey: string): boolean {
		return new PendingMultiSignatureTransaction(transaction.data()).needsWalletSignature(publicKey);
	}

	/** @inheritdoc */
	public needsFinalSignature(transaction: Contracts.SignedTransactionData): boolean {
		return new PendingMultiSignatureTransaction(transaction.data()).needsFinalSignature();
	}

	/** @inheritdoc */
	public getValidMultiSignatures(transaction: Contracts.SignedTransactionData): string[] {
		return new PendingMultiSignatureTransaction(transaction.data()).getValidMultiSignatures();
	}

	/** @inheritdoc */
	public remainingSignatureCount(transaction: Contracts.SignedTransactionData): number {
		return new PendingMultiSignatureTransaction(transaction.data()).remainingSignatureCount();
	}

	/**
	 *
	 *
	 * @private
	 * @param {string} path
	 * @param {Contracts.KeyValuePair} [query]
	 * @returns {Promise<Contracts.KeyValuePair>}
	 * @memberof MultiSignatureService
	 */
	private async get(path: string, query?: Contracts.KeyValuePair): Promise<Contracts.KeyValuePair> {
		return (await this.#http.get(`${this.getPeer()}/${path}`, query)).json();
	}

	/**
	 *
	 *
	 * @private
	 * @param {string} path
	 * @param {Contracts.KeyValuePair} [query]
	 * @returns {Promise<Contracts.KeyValuePair>}
	 * @memberof MultiSignatureService
	 */
	private async delete(path: string, query?: Contracts.KeyValuePair): Promise<Contracts.KeyValuePair> {
		return (await this.#http.delete(`${this.getPeer()}/${path}`, query)).json();
	}

	/**
	 *
	 *
	 * @private
	 * @param {string} path
	 * @param {Contracts.KeyValuePair} body
	 * @returns {Promise<Contracts.KeyValuePair>}
	 * @memberof MultiSignatureService
	 */
	private async post(path: string, body: Contracts.KeyValuePair): Promise<Contracts.KeyValuePair> {
		return (await this.#http.post(`${this.getPeer()}/${path}`, body)).json();
	}

	/**
	 *
	 *
	 * @private
	 * @returns {string}
	 * @memberof MultiSignatureService
	 */
	private getPeer(): string {
		if (this.#config.has("peerMultiSignature")) {
			return this.#config.get<string>("peerMultiSignature");
		}

		return Arr.randomElement(this.#config.get<Coins.CoinNetwork>("network").networking?.hostsMultiSignature || []);
	}

	/**
	 *
	 *
	 * @private
	 * @param {*} transaction
	 * @returns {Record<string, any>}
	 * @memberof MultiSignatureService
	 */
	private normalizeTransaction(transaction): Record<string, any> {
		return {
			...transaction.data,
			...{ id: transaction.id }, // This is the real ID, computed by the MuSig Server.
			multiSignature: transaction.multisigAsset,
		};
	}

	/**
	 *
	 *
	 * @private
	 * @param {string} publicKey
	 * @param {string} state
	 * @returns {Promise<any[]>}
	 * @memberof MultiSignatureService
	 */
	private async fetchAll(publicKey: string, state: string): Promise<any[]> {
		return (
			await this.get("transactions", {
				publicKey,
				state,
			})
		).map((transaction) => this.normalizeTransaction(transaction));
	}
}
