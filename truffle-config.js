const HDprovider = require('@truffle/hdwallet-provider')





module.exports = {
	// Uncommenting the defaults below 
	// provides for an easier quick-start with Ganache.
	// You can also follow this format for other networks;
	// see <http://truffleframework.com/docs/advanced/configuration>
	// for more
	networks: {
		development: {
			host: '127.0.0.1',
			port: 8545,
			network_id: "*",
			// gas: 0x1ffffffffffffe
		},
		goerli: {
			provider: () => 
				new HDprovider(
					{ 
						mnemonic: {phrase: 'boil argue space actor quick route empty soon moon plug proud spread'}, 
						providerOrUrl: 'wss://eth-goerli.ws.alchemyapi.io/v2/9GJ40fZ1PGwqID6jUHOyzdyEsPLqE7Kn',
						numberOfAddresses: 10
					}
				),
			network_id: "5",
			skipDryRun: true
		},
		kovan: {
			provider: () => 
				new HDprovider(
					{ 
						mnemonic: {phrase: 'boil argue space actor quick route empty soon moon plug proud spread'}, 
						providerOrUrl: 'https://kovan.infura.io/v3/7cc9144169d6403d8007b06070f73c76',
						numberOfAddresses: 10
					}
				),
			network_id: "42"
		},
	},
	compilers: {
		solc: {
			version: "0.6.12",
			optimizer: {
				enabled: true,
				runs: 200
			}
		}
	},
	mocha: {
		useColors: true
	},
	plugins: ["truffle-contract-size"]
};
