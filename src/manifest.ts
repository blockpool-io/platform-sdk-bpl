import BplTestnet from "./networks/bpl/testnet";
import BplMainnet from "./networks/bpl/mainnet";

export const manifest = {
	name: "BPL",
	networks: {
		"bpl.mainnet": BplMainnet,
		"bpl.testnet": BplTestnet,
	},
};
