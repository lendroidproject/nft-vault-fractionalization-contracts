/* eslint-disable prefer-const */
const MockPacemaker = artifacts.require("MockPacemaker");

const Vault = artifacts.require("SimpleVault");

const Token0 = artifacts.require("MockToken0");
const Token1 = artifacts.require("MockToken1");
const Token2 = artifacts.require("MockToken2");

const SimpleWallet = artifacts.require("MockSimpleWallet");
const Market = artifacts.require("SimpleMarket");
const Market2 = artifacts.require("SimpleMarket2");

const Buyout = artifacts.require("SimpleBuyout");

module.exports = function (deployer) {
    deployer.deploy(MockPacemaker);
    deployer.deploy(Vault);
    deployer.deploy(Market);
    deployer.deploy(Market2);
    deployer.deploy(Buyout);

    deployer.deploy(Token0);
    deployer.deploy(Token1);
    deployer.deploy(Token2);
    deployer.deploy(SimpleWallet);
};
