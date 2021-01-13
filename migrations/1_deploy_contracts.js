/* eslint-disable prefer-const */
const Vault = artifacts.require("SimpleVault");

const Token0 = artifacts.require("MockToken0");
const Token1 = artifacts.require("MockToken1");
const Token2 = artifacts.require("MockToken2");

const SimpleWallet = artifacts.require("MockSimpleWallet");
const Market = artifacts.require("SimpleMarket");

const Buyout = artifacts.require("SimpleBuyout");

const Redeem = artifacts.require("SimpleRedeem");

module.exports = function (deployer) {
    deployer.deploy(Vault);
    deployer.deploy(Market);
    deployer.deploy(Buyout);
    deployer.deploy(Redeem);

    deployer.deploy(Token0);
    deployer.deploy(Token1);
    deployer.deploy(Token2);
    deployer.deploy(SimpleWallet);
};
