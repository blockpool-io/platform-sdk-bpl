import { Managers } from "@arkecosystem/crypto";
import { Coins, Contracts } from "@arkecosystem/platform-sdk";
import { Arr } from "@arkecosystem/platform-sdk-support";

import { ClientService } from "./services/client";
import { DataTransferObjectService } from "./services/data-transfer-object";
import { FeeService } from "./services/fee";
import { IdentityService } from "./services/identity";
import { KnownWalletService } from "./services/known-wallets";
import { LedgerService } from "./services/ledger";
import { LinkService } from "./services/link";
import { MessageService } from "./services/message";
import { MultiSignatureService } from "./services/multi-signature";
import { PeerService } from "./services/peer";
import { TransactionService } from "./services/transaction";

export class ServiceProvider {
	public static async make(coin: Coins.CoinSpec, config: Coins.Config): Promise<Coins.CoinServices> {
		config.set(Coins.ConfigKey.NetworkConfiguration, await ServiceProvider.retrieveNetworkConfiguration(config));

		const multiSignature = await MultiSignatureService.__construct(config);

		const [
			client,
			dataTransferObject,
			fee,
			identity,
			knownWallets,
			ledger,
			link,
			message,
			peer,
			transaction,
		] = await Promise.all([
			ClientService.__construct(config) as any,
			DataTransferObjectService.__construct(config),
			FeeService.__construct(config),
			IdentityService.__construct(config),
			KnownWalletService.__construct(config),
			LedgerService.__construct(config),
			LinkService.__construct(config),
			MessageService.__construct(config),
			PeerService.__construct(config),
			TransactionService.__construct(config),
		]);

		return {
			client,
			dataTransferObject,
			fee,
			identity,
			knownWallets,
			ledger,
			link,
			message,
			multiSignature,
			peer,
			transaction,
		};
	}

	private static async retrieveNetworkConfiguration(config: Coins.Config): Promise<{ crypto; peer; status }> {
		const http: Contracts.HttpClient = config.get<Contracts.HttpClient>("httpClient");

		let peer: string;
		try {
			peer = config.get<string>("peer");
		} catch {
			peer = `${Arr.randomElement(config.get<string[]>("network.networking.hosts"))}/api`;
		}

		const [crypto, status]: any = await Promise.all([
			http.get(`${peer}/node/configuration/crypto`),
			http.get(`${peer}/node/syncing`),
		]);

		const dataCrypto = crypto.json().data;
		const dataStatus = status.json().data;

		if (dataCrypto.network.client.token !== config.get(Coins.ConfigKey.CurrencyTicker)) {
			throw new Error(`Failed to connect to ${peer} because it is on another network.`);
		}

		Managers.configManager.setConfig(dataCrypto);
		Managers.configManager.setHeight(dataStatus.height);

		return { crypto: dataCrypto, peer, status: dataStatus };
	}
}
