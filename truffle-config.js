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
						mnemonic: {phrase: 'mnemonic'}, 
						providerOrUrl: 'https://kovan.infura.io/v3/<infura projectId>',
						numberOfAddresses: 10
					}
				),
			network_id: "5",
			// skipDryRun: true
		},
		kovan: {
			provider: () => 
				new HDprovider(
					{ 
						mnemonic: {phrase: 'mnemonic'}, 
						providerOrUrl: 'https://kovan.infura.io/v3/<infura projectId>',
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
