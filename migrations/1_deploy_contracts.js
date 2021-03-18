const MockPacemaker = artifacts.require("MockPacemaker");
const SimpleWallet = artifacts.require("MockSimpleWallet");

const Vault = artifacts.require("SimpleVault");

const Token0 = artifacts.require("MockToken0");
const Token1 = artifacts.require("MockToken1");
const Token2 = artifacts.require("MockToken2");

const Market = artifacts.require("SimpleMarket");
const Market2 = artifacts.require("SimpleMarket2");

const Buyout = artifacts.require("SimpleBuyout");

const BUYOUT_START_THRESHOLD = 10000000; // 10 million worth of Token2
const BUYOUT_STOP_THRESHOLD_PERCENTAGE = 25; // Buyout stops if 25% of Token0 are staked
const BUYOUT_DURATION_IN_EPOCHS = 42;
const BID_INTERVAL_IN_EPOCHS = 9;

module.exports = function (deployer) {
    deployer.then(async () => {
        await deployer.deploy(MockPacemaker);
        await deployer.deploy(SimpleWallet);
        await deployer.deploy(Vault);
        await deployer.deploy(Token0);
        await deployer.deploy(Token1);
        await deployer.deploy(Token2);
        await deployer.deploy(Market);
        await deployer.deploy(Market2);
        await deployer.deploy(Buyout, Token0.address, Token2.address, Vault.address, [
            web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
            BUYOUT_DURATION_IN_EPOCHS,
            BID_INTERVAL_IN_EPOCHS,
            BUYOUT_STOP_THRESHOLD_PERCENTAGE
        ]);
    });
};
