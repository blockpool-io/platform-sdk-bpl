import { Coins, Contracts, Helpers } from "@arkecosystem/platform-sdk";
import { Arr } from "@arkecosystem/platform-sdk-support";
import dotify from "node-dotify";

import { WalletData } from "../dto";
import * as TransactionDTO from "../dto";

export class ClientService implements Contracts.ClientService {
	readonly #config: Coins.Config;
	readonly #http: Contracts.HttpClient;
	readonly #network: string;

	private constructor(config: Coins.Config) {
		this.#config = config;
		this.#http = config.get<Contracts.HttpClient>("httpClient");
		this.#network = config.get<string>("network.id");
	}

	public static async __construct(config: Coins.Config): Promise<ClientService> {
		return new ClientService(config);
	}

	public async __destruct(): Promise<void> {
		//
	}

	public async transaction(
		id: string,
		input?: Contracts.TransactionDetailInput,
	): Promise<Contracts.TransactionDataType> {
		const body = await this.get(`transactions/${id}`);

		return Helpers.createTransactionDataWithType(body.data, TransactionDTO);
	}

	public async transactions(query: Contracts.ClientTransactionsInput): Promise<Coins.TransactionDataCollection> {
		const response = this.isUpcoming()
			? await this.get("transactions", this.createSearchParams(query))
			: await this.post("transactions/search", this.createSearchParams(query));

		return Helpers.createTransactionDataCollectionWithType(
			response.data,
			this.createMetaPagination(response),
			TransactionDTO,
		);
	}

	public async wallet(id: string): Promise<Contracts.WalletData> {
		const body = await this.get(`wallets/${id}`);

		return new WalletData(body.data);
	}

	public async wallets(query: Contracts.ClientWalletsInput): Promise<Coins.WalletDataCollection> {
		const response = this.isUpcoming()
			? await this.get("wallets", this.createSearchParams(query))
			: await this.post("wallets/search", this.createSearchParams(query));

		return new Coins.WalletDataCollection(
			response.data.map((wallet) => new WalletData(wallet)),
			this.createMetaPagination(response),
		);
	}

	public async delegate(id: string): Promise<Contracts.WalletData> {
		const body = await this.get(`delegates/${id}`);

		return new WalletData(body.data);
	}

	public async delegates(query?: Contracts.KeyValuePair): Promise<Coins.WalletDataCollection> {
		const body = await this.get("delegates", this.createSearchParams(query || {}));

		return new Coins.WalletDataCollection(
			body.data.map((wallet) => new WalletData(wallet)),
			this.createMetaPagination(body),
		);
	}

	public async votes(id: string): Promise<Contracts.VoteReport> {
		const { data } = await this.get(`wallets/${id}`);

		const hasVoted = data.attributes?.vote !== undefined;

		return {
			used: hasVoted ? 1 : 0,
			available: hasVoted ? 0 : 1,
			publicKeys: hasVoted ? [data.attributes?.vote] : [],
		};
	}

	public async voters(id: string, query?: Contracts.KeyValuePair): Promise<Coins.WalletDataCollection> {
		const body = await this.get(`delegates/${id}/voters`, this.createSearchParams(query || {}));

		return new Coins.WalletDataCollection(
			body.data.map((wallet) => new WalletData(wallet)),
			this.createMetaPagination(body),
		);
	}

	public async syncing(): Promise<boolean> {
		const body = await this.get("node/syncing");

		return body.data.syncing;
	}

	public async broadcast(transactions: Contracts.SignedTransactionData[]): Promise<Contracts.BroadcastResponse> {
		let response: Contracts.KeyValuePair;

		try {
			response = await this.post("transactions", {
				body: {
					transactions: transactions.map((transaction: Contracts.SignedTransactionData) =>
						transaction.toBroadcast(),
					),
				},
			});
		} catch (error) {
			response = error.response.json();
		}

		return this.handleBroadcastResponse(response);
	}

	public async broadcastSpread(
		transactions: Contracts.SignedTransactionData[],
		hosts: string[],
	): Promise<Contracts.BroadcastResponse> {
		const promises: any[] = [];

		for (const host of hosts) {
			promises.push(
				new Promise(async (resolve, reject) => {
					try {
						return resolve(
							(
								await this.#http.post(`${host}/transactions`, {
									transactions: transactions.map((transaction: Contracts.SignedTransactionData) =>
										transaction.toBroadcast(),
									),
								})
							).json(),
						);
					} catch (error) {
						return reject(error.response.json());
					}
				}),
			);
		}

		let response: Contracts.KeyValuePair = {};

		const results: any = await Promise.allSettled(promises);

		for (const result of results) {
			if (result.status === "fulfilled") {
				response = result.value;

				break;
			}
		}

		return this.handleBroadcastResponse(response);
	}

	private async get(path: string, query?: Contracts.KeyValuePair): Promise<Contracts.KeyValuePair> {
		return (await this.#http.get(`${this.host()}/${path}`, query?.searchParams)).json();
	}

	private async post(path: string, { body, searchParams }: { body; searchParams? }): Promise<Contracts.KeyValuePair> {
		return (await this.#http.post(`${this.host()}/${path}`, body, searchParams || undefined)).json();
	}

	private createMetaPagination(body): Contracts.MetaPagination {
		const getPage = (url: string): string | undefined => {
			const match: RegExpExecArray | null = RegExp(/page=(\d+)/).exec(url);

			return match ? match[1] || undefined : undefined;
		};

		return {
			prev: getPage(body.meta.previous) || undefined,
			self: getPage(body.meta.self) || undefined,
			next: getPage(body.meta.next) || undefined,
		};
	}

	private createSearchParams(body: Contracts.ClientPagination): { body: object | null; searchParams: object | null } {
		if (Object.keys(body).length <= 0) {
			return { body: null, searchParams: null };
		}

		const result: any = {
			body,
			searchParams: {},
		};

		const mappings: Record<string, string> = {
			cursor: "page",
			limit: "limit",
			orderBy: "orderBy",
		};

		if (this.isUpcoming()) {
			Object.assign(mappings, {
				address: "address",
				recipientId: "recipientId",
				senderId: "senderId",
				senderPublicKey: "senderPublicKey",
			});
		}

		for (const [alias, original] of Object.entries(mappings)) {
			if (body[alias]) {
				result.searchParams[original] = body[alias];

				delete result.body[alias];
			}
		}

		const hasEntityType: boolean = result.body.entityType !== undefined;
		const hasEntityAction: boolean = result.body.entityAction !== undefined;

		if (hasEntityType && hasEntityAction) {
			result.body.type = 6;
			result.body.typeGroup = 2;

			if (result.body.entityType !== "all") {
				result.body.asset = {
					type: result.body.entityType,
					action: { register: 0, update: 1, resign: 2 }[result.body.entityAction],
				};

				if (result.body.entitySubType !== undefined) {
					result.body.asset.subType = result.body.entitySubType;
				}
			}

			delete result.body.entityType;
			delete result.body.entitySubType;
			delete result.body.entityAction;
		}

		if (this.isUpcoming()) {
			// @ts-ignore
			const addresses: string[] | undefined = body.addresses as string[];

			if (Array.isArray(addresses)) {
				result.searchParams.address = addresses.join(",");

				// @ts-ignore
				delete body.addresses;
			}

			result.searchParams = dotify({ ...result.searchParams, ...result.body });
			result.body = null;
		}

		return result;
	}

	private handleBroadcastResponse(response): Contracts.BroadcastResponse {
		const { data, errors } = response;

		const result: Contracts.BroadcastResponse = {
			accepted: [],
			rejected: [],
			errors: {},
		};

		if (Array.isArray(data.accept)) {
			result.accepted = data.accept;
		}

		if (Array.isArray(data.invalid)) {
			result.rejected = data.invalid;
		}

		if (errors) {
			for (const [key, value] of Object.entries(errors)) {
				if (!Array.isArray(result.errors[key])) {
					result.errors[key] = [];
				}

				// @ts-ignore
				for (const error of value) {
					// @ts-ignore
					result.errors[key].push(error.type);
				}
			}
		}

		return result;
	}

	private isUpcoming(): boolean {
		return this.#network === "ark.devnet";
	}

	private host(): string {
		try {
			return this.#config.get<string>("peer");
		} catch {
			return `${Arr.randomElement(this.#config.get<string[]>("network.networking.hosts"))}/api`;
		}
	}
}
