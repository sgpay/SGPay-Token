const Controller = artifacts.require('./controller/Controller.sol');
const SGPayPresale = artifacts.require('./helpers/MockSGPayPresale.sol');
const SGPayCrowdsale = artifacts.require('./helpers/MockSGPayCrowdsale.sol');
const MockWallet = artifacts.require('./mocks/MockWallet.sol');
const Token = artifacts.require('./token/Token.sol');
const DataCentre = artifacts.require('./token/DataCentre.sol');
const MultisigWallet = artifacts.require('./multisig/solidity/MultiSigWalletWithDailyLimit.sol');
import {advanceBlock} from './helpers/advanceToBlock';
import latestTime from './helpers/latestTime';
import increaseTime from './helpers/increaseTime';
const BigNumber = require('bignumber.js');
const assertJump = require('./helpers/assertJump');
const ONE_ETH = web3.toWei(1, 'ether');
const MOCK_ONE_ETH = web3.toWei(0.000001, 'ether'); // diluted ether value for testing
const FOUNDERS = [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3]];

contract('Controller', (accounts) => {
  let token;
  let dataCentre;
  let multisigWallet;
  let crowdsale;
  let controller;

  beforeEach(async () => {
    token = await Token.new();
    dataCentre = await DataCentre.new();
    controller = await Controller.new(token.address, dataCentre.address);
    await token.transferOwnership(controller.address);
    await dataCentre.transferOwnership(controller.address);
    await controller.unpause();
    await controller.mint(accounts[0], 3800000e18);
  });

  describe('#changeRate', () => {
    let multisigWallet;
    let startTime;
    let ends;
    let rates;
    let caps;
    let goal;
    let sgPayPresale;
    let sgPayCrowdsale;

    beforeEach(async () => {
      await advanceBlock();
      startTime = latestTime();
      ends = startTime + 86400*14;
      rates = 2125;
      caps = 2000000e18;
      multisigWallet = await MultisigWallet.new(FOUNDERS, 3, 10*MOCK_ONE_ETH);
      sgPayPresale = await SGPayPresale.new(startTime, ends, rates, multisigWallet.address, controller.address, caps);
      await controller.addAdmin(sgPayPresale.address);

      ends = startTime + 86400*31;
      rates = 1700;
      goal = 1500e18;
      caps = 10000000e18;
      sgPayCrowdsale = await SGPayCrowdsale.new(startTime, ends, rates, multisigWallet.address, controller.address, caps, goal);
    });

    it('should allow change rates during preSale', async () => {
    await controller.changeRate(400);
    assert.equal((await sgPayPresale.rate.call()).toNumber(), 400);
    });

    it('should allow change rates during crowdsale', async () => {
    await controller.removeAdmin(sgPayPresale.address);
    await controller.addAdmin(sgPayCrowdsale.address);
    await controller.changeRate(400);
    assert.equal((await sgPayCrowdsale.rate.call()).toNumber(), 400);
    });
  });

  it('should allow start Minting after stopping', async () => {
  await controller.finishMinting();
  await controller.startMinting();
  const mintStatus = await controller.mintingFinished.call();
  assert.equal(mintStatus, false);
  });

  it('should allow to set new contracts', async () => {
  await controller.pause();
  const dataCentre = await DataCentre.new();
  token = await Token.new();
  await dataCentre.transferOwnership(controller.address);
  await controller.setContracts(token.address, dataCentre.address);
  const dataCentreSet = await controller.dataCentreAddr.call();
  assert.equal(dataCentreSet, dataCentre.address);
  });

  it('should allow to kill', async () => {
  await controller.pause();
  const dataCentreOld = await controller.dataCentreAddr.call();
  const controllerNew = await Controller.new(token.address, dataCentreOld);
  await controller.kill(controllerNew.address);
  const dataCentreSet = await controllerNew.dataCentreAddr.call();
  const tokenSet = await controllerNew.satellite.call();
  assert.equal(dataCentreSet, dataCentreOld);
  assert.equal(tokenSet, token.address);
  });
});
