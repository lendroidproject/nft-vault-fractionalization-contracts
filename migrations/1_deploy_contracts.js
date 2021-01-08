/* eslint-disable prefer-const */
const Vault = artifacts.require("Vault");

const Token0 = artifacts.require("MockToken0");
const Token1 = artifacts.require("MockToken1");
const Token2 = artifacts.require("MockToken2");

const SimpleWallet = artifacts.require("MockSimpleWallet");
const SimpleTreasury = artifacts.require("MockSimpleTreasury");
const Market = artifacts.require("Market");

const Buyout = artifacts.require("Buyout");

const Redeem = artifacts.require("Redeem");

module.exports = function (deployer) {
    deployer.deploy(Vault);
    deployer.deploy(Market);
    deployer.deploy(Buyout);
    deployer.deploy(Redeem);

    deployer.deploy(Token0);
    deployer.deploy(Token1);
    deployer.deploy(Token2);
    deployer.deploy(SimpleWallet);
    deployer.deploy(SimpleTreasury);
};
