# b20-contracts
Smart contracts for the B.20 project

## Framework
This branch consists of (simplified versions of) 4 main smart contracts:

1. `SimpleVault.sol` -> Collector locks their NFTs. Vault ownership is transferred to successful bidder from the Buyout process.
2. `SimpleMarket.sol` -> Collector sells ERC20 Token0s representing the Vault, by accepting ERC20 Token1 as payment. No individual cap.
3. `SimpleMarket2.sol` -> Collector sells ERC20 Token0s representing the Vault, by accepting ERC20 Token1 as payment. Has individual cap.
4. `SimpleBuyout.sol` -> Anyone can bid for the Vault using ERC20 Token2. Anyone can stake Token0 to prevent the buyout.


All the contracts in this repository have been written in Solidity v0.7.5

Please use Git commits according to this article: https://chris.beams.io/posts/git-commit

## Installation and setup
* Clone this repository

  `git clone <repo>`

* cd into the cloned repo

  `cd b20-contracts`

* Install dependencies via npm

  `npm install`


## Test and development

* Open new terminal, run ganache

  `ganache-cli`

### Setup Truffle virtual environment

* Open new terminal

* Create a virtual environment

  `virtualenv -p python3.7 --no-site-packages ~/truffle-venv`

* Activate the virtual environment

  `source ~/truffle-venv/bin/activate`

* Install vyper using pip

  `<truffle-venv>pip install vyper`

* Compile the contracts

  `<truffle-venv>npm run build`

* Run the tests

  `<truffle-venv>npm run test`

* Run the coverage

  `<truffle-venv>npm run test-coverage`

Note : After test / development, deactivate the virtual environment
  `<truffle-venv>deactivate`
