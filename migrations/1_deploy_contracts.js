var MockFestival = artifacts.require("MockFestival");
var MockFestivalToken = artifacts.require("MockFestivalToken");
var SimpleWallet = artifacts.require("SimpleWallet");

module.exports = function(deployer) {
    deployer.deploy(MockFestivalToken)
        .then(function() {
            return deployer.deploy(SimpleWallet);
        })
        .then(function() {
            return deployer.deploy(MockFestival, MockFestivalToken.address, SimpleWallet.address);
        });
};
