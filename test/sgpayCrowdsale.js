const Controller = artifacts.require('./controller/Controller.sol');
const Presale = artifacts.require('./mocks/MockSGPayPresale.sol');
const CrowdsaleMain = artifacts.require('./mocks/MockSGPayCrowdsaleMain.sol');
const CrowdsaleK = artifacts.require('./mocks/MockSGPayCrowdsaleK.sol');
const MockWallet = artifacts.require('./mocks/MockWallet.sol');
const Token = artifacts.require('./crowdsaleMain/SGPay.sol');
const DataCentre = artifacts.require('./token/DataCentre.sol');
const MultisigWallet = artifacts.require('./multisig/solidity/MultiSigWalletWithDailyLimit.sol');
const TestCaseHelper = artifacts.require('./mocks/TestCaseHelper.sol');
import {advanceBlock} from './helpers/advanceToBlock';
import latestTime from './helpers/latestTime';
import increaseTime from './helpers/increaseTime';
const BigNumber = require('bignumber.js');
const assertJump = require('./helpers/assertJump');
const ONE_ETH = web3.toWei(1, 'ether');
const MOCK_ONE_ETH = web3.toWei(0.000001, 'ether'); // diluted ether value for testing
const FOUNDERS = [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3]];

contract('SGpayCrowdsale', (accounts) => {
  let token;
  let dataCentre;
  let endTime;
  let rate;
  let tokenCap;
  let startTime;
  let multisigWallet;
  let presale;
  let controller;

  beforeEach(async () => {
    await advanceBlock();
    startTime = latestTime();
    endTime = startTime + 86400*14;
    rate = 2125;
    tokenCap = 2000000e18;
    token = await Token.new();
    multisigWallet = await MultisigWallet.new(FOUNDERS, 3, 10*MOCK_ONE_ETH);
    dataCentre = await DataCentre.new();
    controller = await Controller.new(token.address, dataCentre.address);
    presale = await Presale.new(startTime, endTime, rate, multisigWallet.address, controller.address, tokenCap);
    await controller.addAdmin(presale.address);
    await token.transferOwnership(controller.address);
    await dataCentre.transferOwnership(controller.address);
    await controller.unpause();
    await controller.mint(accounts[0], 3800000e18);
  });

  describe('#presale', () => {

    it('should allow start presale properly', async () => {
    // checking startTime
    const startTimeSet = await presale.startTime.call();
    assert.equal(startTime, startTimeSet.toNumber(), 'startTime not set right');

    //checking initial token distribution details
    const initialBalance = await token.balanceOf.call(accounts[0]);
    assert.equal(3800000e18, initialBalance.toNumber(), 'initialBalance for sale NOT distributed properly');

    //checking token and wallet address
    const tokenAddress = await controller.satellite.call();
    const walletAddress = await presale.wallet.call();
    assert.equal(tokenAddress, token.address, 'address for token in contract not set');
    assert.equal(walletAddress, multisigWallet.address, 'address for multisig wallet in contract not set');

    //list rate and check
    const rate = await presale.rate.call();
    const endTime = await presale.endTime.call();
    const tokenCapSet = await presale.tokenCap.call();

    assert.equal(tokenCapSet.toNumber(), tokenCap, 'tokenCap not set');
    assert.equal(endTime.toNumber(), endTime, 'endTime not set right');
    assert.equal(rate.toNumber(), rate, 'rate not set right');
    });

    it('should not allow to start presale if endTime smaller than startTime',  async () => {
      let presaleNew;
      endTime = startTime - 1;
      try {
        presaleNew = await Presale.new(startTime, endTime, rate, multisigWallet.address, controller.address, tokenCap);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(presaleNew, undefined, 'presale still initialized');
    });

    it('should not allow to start presale due to ZERO rate',  async () => {
      let presaleNew;
      try {
        presaleNew = await Presale.new(startTime, endTime, 0, multisigWallet.address, controller.address, tokenCap);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(presaleNew, undefined, 'presale still initialized');
    });

    it('should not allow to start presale if cap is zero',  async () => {
      let presaleNew;
      try {
        presaleNew = await Presale.new(startTime, endTime, rate, multisigWallet.address, controller.address, 0);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(presaleNew, undefined, 'presale still initialized');
    });

    it('should allow investors to buy tokens at the constant swapRate', async () => {
      const INVESTOR = accounts[4];

      // buy tokens
      await presale.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const tokensBalance = await token.balanceOf.call(INVESTOR);

      const tokensAmount = new BigNumber(MOCK_ONE_ETH).mul(rate);
      assert.equal(walletBalance.toNumber(), MOCK_ONE_ETH, 'ether not deposited into the wallet');
      assert.equal(tokensBalance.toNumber(), tokensAmount.toNumber(), 'tokens not deposited into the INVESTOR balance');
    });


    it('should allow investors to buy tokens just below tokenCap in the 1st phase', async () => {
      await presale.diluteCap();
      const INVESTORS = accounts[4];
      const amountEth = (Math.round((tokenCap/1e18)/rate) - 1) * MOCK_ONE_ETH;
      const tokensAmount = rate * amountEth;

      //  buy tokens
      await presale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupply = await presale.totalSupply.call();

      assert.equal(walletBalance.toNumber(), amountEth, 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount, 'balance still added for investor');
      assert.equal(totalSupply.toNumber(), tokensAmount, 'balance not added to totalSupply');
    });

    it('should allow investors to buy tokens just equal to tokenCap in the 1st phase', async () => {
      await presale.diluteCap();
      const INVESTORS = accounts[4];
      const amountEth = Math.round((tokenCap/1e18)/rate) * MOCK_ONE_ETH;
      const tokensAmount = rate * amountEth;

      //  buy tokens
      await presale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupply = await presale.totalSupply.call();

      assert.equal(walletBalance.toNumber(), amountEth, 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount, 'balance still added for investor');
      assert.equal(totalSupply.toNumber(), tokensAmount, 'balance not added to totalSupply');
    });


    it('should not allow investors to buy tokens above tokenCap in the 1st phase', async () => {
      await presale.diluteCap();
      const INVESTORS = accounts[4];
      const amountEth = (Math.round((tokenCap/1e18)/rate) + 1) * MOCK_ONE_ETH;
      const tokensAmount = rate * amountEth;

      //  buy tokens
      try {
        await presale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
        assert.fail('should have failed before');
      } catch (error) {
        assertJump(error);
      }

      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupply = await presale.totalSupply.call();
      assert.equal(walletBalance.toNumber(), 0, 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), 0, 'balance still added for investor');
      assert.equal(totalSupply.toNumber(), 0, 'balance still added to totalSupply');
    });
  })


  describe('#crowdsale', () => {
    let goal;
    let crowdsaleMain;
    let crowdsaleK;
    let endTime;
    let startTime;
    let vaultAddr;
    let preSale;

    beforeEach(async () => {
      await advanceBlock();
      startTime = latestTime();
      endTime = startTime + 86400*31;
      rate = 1700;
      goal = 1500e18;
      tokenCap = 10000000e18;
      preSale = await TestCaseHelper.new();
      crowdsaleMain = await CrowdsaleMain.new(startTime, endTime, rate, multisigWallet.address, controller.address, preSale.address, tokenCap, goal);
      vaultAddr = await crowdsaleMain.vault.call();
      crowdsaleK = await CrowdsaleK.new(startTime, endTime, rate, multisigWallet.address, controller.address, preSale.address, tokenCap, vaultAddr);
      await crowdsaleMain.setKico(crowdsaleK.address);
      await crowdsaleK.setMain(crowdsaleMain.address);
      await controller.removeAdmin(presale.address);
      await controller.addAdmin(crowdsaleMain.address);
      await controller.addAdmin(crowdsaleK.address);
    });

    it('should allow start crowdsaleMain properly', async () => {
    // checking startTime
    const startTimeSet = await crowdsaleMain.startTime.call();
    assert.equal(startTime, startTimeSet.toNumber(), 'startTime not set right');

    //checking initial token distribution details
    const initialBalance = await token.balanceOf.call(accounts[0]);
    assert.equal(3800000e18, initialBalance.toNumber(), 'initialBalance for sale NOT distributed properly');

    //checking token and wallet address
    const tokenAddress = await controller.satellite.call();
    const walletAddress = await crowdsaleMain.wallet.call();
    assert.equal(tokenAddress, token.address, 'address for token in contract not set');
    assert.equal(walletAddress, multisigWallet.address, 'address for multisig wallet in contract not set');

    //list rate and check
    const rate = await crowdsaleMain.rate.call();
    const endTime = await crowdsaleMain.endTime.call();
    const tokenCapSet = await crowdsaleMain.tokenCap.call();
    const goal = await crowdsaleMain.goal.call();

    assert.equal(goal.toNumber(), goal, 'tokenCap not set');
    assert.equal(tokenCapSet.toNumber(), tokenCap, 'tokenCap not set');
    assert.equal(endTime.toNumber(), endTime, 'endTime not set right');
    assert.equal(rate.toNumber(), rate, 'rate not set right');
    });


    it('should allow start crowdsaleK properly', async () => {
    // checking startTime
    const startTimeSet = await crowdsaleK.startTime.call();
    assert.equal(startTime, startTimeSet.toNumber(), 'startTime not set right');

    //checking initial token distribution details
    const initialBalance = await token.balanceOf.call(accounts[0]);
    assert.equal(3800000e18, initialBalance.toNumber(), 'initialBalance for sale NOT distributed properly');

    //checking token and wallet address
    const tokenAddress = await controller.satellite.call();
    const walletAddress = await crowdsaleK.wallet.call();
    assert.equal(tokenAddress, token.address, 'address for token in contract not set');
    assert.equal(walletAddress, multisigWallet.address, 'address for multisig wallet in contract not set');

    //list rate and check
    const rate = await crowdsaleK.rate.call();
    const endTime = await crowdsaleK.endTime.call();
    const tokenCapSet = await crowdsaleK.tokenCap.call();

    assert.equal(tokenCapSet.toNumber(), tokenCap, 'tokenCap not set');
    assert.equal(endTime.toNumber(), endTime, 'endTime not set right');
    assert.equal(rate.toNumber(), rate, 'rate not set right');
    assert.equal(await crowdsaleMain.vault.call(), await crowdsaleK.vault.call());
    });

    it('should not allow to start crowdsaleMain if endTime smaller than startTime',  async () => {
      let crowdsaleMainNew;
      endTime = startTime - 1;
      try {
        crowdsaleMainNew = await CrowdsaleMain.new(startTime, endTime, rate, multisigWallet.address, controller.address, preSale.address, tokenCap, goal);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleMainNew, undefined, 'crowdsaleMain still initialized');
    });

    it('should not allow to start crowdsaleMain due to ZERO rate',  async () => {
      let crowdsaleMainNew;
      try {
        crowdsaleMainNew = await CrowdsaleMain.new(startTime, endTime, 0, multisigWallet.address, controller.address, preSale.address, tokenCap, goal);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleMainNew, undefined, 'crowdsaleMain still initialized');
    });

    it('should not allow to start crowdsaleMain if cap is zero',  async () => {
      let crowdsaleMainNew;
      try {
        crowdsaleMainNew = await CrowdsaleMain.new(startTime, endTime, rate, multisigWallet.address, controller.address, preSale.address, 0, goal);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleMainNew, undefined, 'crowdsaleMain still initialized');
    });

    it('should not allow to start crowdsaleMain if goal is zero',  async () => {
      let crowdsaleMainNew;
      try {
        crowdsaleMainNew = await CrowdsaleMain.new(startTime, endTime, rate, multisigWallet.address, controller.address, preSale.address, tokenCap, 0);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleMainNew, undefined, 'crowdsaleMain still initialized');
    });

    it('should not allow to start crowdsaleMain if presale address is zero',  async () => {
      let crowdsaleMainNew;
      try {
        crowdsaleMainNew = await CrowdsaleMain.new(startTime, endTime, rate, multisigWallet.address, controller.address, 0x00, tokenCap, goal);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleMainNew, undefined, 'crowdsaleMain still initialized');
    });

    it('should not allow to start crowdsaleK if endTime smaller than startTime',  async () => {
      let crowdsaleKNew;
      endTime = startTime - 1;
      try {
        crowdsaleKNew = await CrowdsaleK.new(startTime, endTime, rate, multisigWallet.address, controller.address, preSale.address, tokenCap, vaultAddr);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleKNew, undefined, 'crowdsaleK still initialized');
    });

    it('should not allow to start crowdsaleK due to ZERO rate',  async () => {
      let crowdsaleKNew;
      try {
        crowdsaleKNew = await CrowdsaleK.new(startTime, endTime, 0, multisigWallet.address, controller.address, preSale.address, tokenCap, vaultAddr);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleKNew, undefined, 'crowdsaleK still initialized');
    });

    it('should not allow to start crowdsaleK if cap is zero',  async () => {
      let crowdsaleKNew;
      try {
        crowdsaleKNew = await CrowdsaleK.new(startTime, endTime, rate, multisigWallet.address, controller.address, preSale.address, 0, vaultAddr);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleKNew, undefined, 'crowdsaleK still initialized');
    });

    it('should not allow to start crowdsaleK if vaultAddr is zero',  async () => {
      let crowdsaleKNew;
      try {
        crowdsaleKNew = await CrowdsaleK.new(startTime, endTime, rate, multisigWallet.address, controller.address, preSale.address, tokenCap, 0x00);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleKNew, undefined, 'crowdsaleK still initialized');
    });

    it('should not allow to start crowdsaleK if endTime smaller than startTime',  async () => {
      let crowdsaleKNew;
      try {
        crowdsaleKNew = await CrowdsaleK.new(startTime, endTime, rate, multisigWallet.address, controller.address, 0x00, tokenCap, vaultAddr);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleKNew, undefined, 'crowdsaleK still initialized');
    });

    it('should allow investors to buy tokens at the constant swapRate from either contract', async () => {
      const INVESTOR = accounts[4];

      // buy tokens
      await crowdsaleMain.buyTokens(INVESTOR, {value: 2*MOCK_ONE_ETH, from: INVESTOR});
      await crowdsaleK.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});
      const vaultAddr = await crowdsaleMain.vault.call();
      const vaultBalance = await web3.eth.getBalance(vaultAddr);
      const tokensBalance = await token.balanceOf.call(INVESTOR);

      const tokensAmountMain = new BigNumber(2*MOCK_ONE_ETH).mul(rate);
      const tokensAmountK = new BigNumber(MOCK_ONE_ETH).mul(rate);

      const tokensAmount = tokensAmountMain.add(tokensAmountK);
      assert.equal(vaultBalance.toNumber(), 3*MOCK_ONE_ETH, 'ether not deposited into the wallet');
      assert.equal(tokensBalance.toNumber(), tokensAmount.toNumber(), 'tokens not deposited into the INVESTOR balance');

      // check readings from both contract
      assert.equal((await crowdsaleMain.weiRaisedIndividual()).toNumber(), 2*MOCK_ONE_ETH);
      assert.equal((await crowdsaleK.weiRaisedIndividual()).toNumber(), MOCK_ONE_ETH);

      assert.equal((await crowdsaleMain.weiRaised()).toNumber(), 3*MOCK_ONE_ETH);
      assert.equal((await crowdsaleK.weiRaised()).toNumber(), 3*MOCK_ONE_ETH);

      assert.equal((await crowdsaleMain.totalSupplyIndividual()).toNumber(), tokensAmountMain.toNumber());
      assert.equal((await crowdsaleK.totalSupplyIndividual()).toNumber(), tokensAmountK.toNumber());

      assert.equal((await crowdsaleMain.totalSupply()).toNumber(), tokensAmount.toNumber());
      assert.equal((await crowdsaleK.totalSupply()).toNumber(), tokensAmount.toNumber());
    });


    it('should allow investors to buy tokens just below tokenCap combined from both contracts in the 1st phase', async () => {
      await crowdsaleMain.diluteCaps();
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((tokenCap/1e18)/rate) - 1).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rate).mul(amountEth);

      //  buy tokens
      await crowdsaleMain.buyTokens(INVESTORS, {value: amountEth.div(2), from: INVESTORS});
      await crowdsaleK.buyTokens(INVESTORS, {value: amountEth.div(2), from: INVESTORS});
      const vaultAddr = await crowdsaleMain.vault.call();
      const vaultBalance = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupply = await crowdsaleMain.totalSupply.call();

      assert.equal(vaultBalance.toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount.toNumber(), 'balance still added for investor');
      assert.equal(totalSupply.toNumber(), tokensAmount.toNumber(), 'balance not added to totalSupply');

      // check readings from both contract
      assert.equal((await crowdsaleMain.weiRaisedIndividual()).toNumber(), (amountEth.div(2)).toNumber());
      assert.equal((await crowdsaleK.weiRaisedIndividual()).toNumber(), (amountEth.div(2)).toNumber());

      assert.equal((await crowdsaleMain.weiRaised()).toNumber(), amountEth.toNumber());
      assert.equal((await crowdsaleK.weiRaised()).toNumber(), amountEth.toNumber());

      assert.equal((await crowdsaleMain.totalSupplyIndividual()).toNumber(), tokensAmount.div(2).toNumber());
      assert.equal((await crowdsaleK.totalSupplyIndividual()).toNumber(), tokensAmount.div(2).toNumber());

      assert.equal((await crowdsaleMain.totalSupply()).toNumber(), tokensAmount.toNumber());
      assert.equal((await crowdsaleK.totalSupply()).toNumber(), tokensAmount.toNumber());
    });

    it('should allow investors to buy tokens just equal to tokenCap combined from both contracts in the 1st phase', async () => {
      await crowdsaleMain.diluteCaps();
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((tokenCap/1e18)/rate)).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rate).mul(amountEth);

      //  buy tokens
      await crowdsaleMain.buyTokens(INVESTORS, {value: amountEth.div(2), from: INVESTORS});
      await crowdsaleK.buyTokens(INVESTORS, {value: amountEth.div(2), from: INVESTORS});
      const vaultAddr = await crowdsaleMain.vault.call();
      const vaultBalance = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupply = await crowdsaleMain.totalSupply.call();

      assert.equal(vaultBalance.toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount.toNumber(), 'balance still added for investor');
      assert.equal(totalSupply.toNumber(), tokensAmount.toNumber(), 'balance not added to totalSupply');

      // check readings from both contract
      assert.equal((await crowdsaleMain.weiRaisedIndividual()).toNumber(), (amountEth.div(2)).toNumber());
      assert.equal((await crowdsaleK.weiRaisedIndividual()).toNumber(), (amountEth.div(2)).toNumber());

      assert.equal((await crowdsaleMain.weiRaised()).toNumber(), amountEth.toNumber());
      assert.equal((await crowdsaleK.weiRaised()).toNumber(), amountEth.toNumber());

      assert.equal((await crowdsaleMain.totalSupplyIndividual()).toNumber(), tokensAmount.div(2).toNumber());
      assert.equal((await crowdsaleK.totalSupplyIndividual()).toNumber(), tokensAmount.div(2).toNumber());

      assert.equal((await crowdsaleMain.totalSupply()).toNumber(), tokensAmount.toNumber());
      assert.equal((await crowdsaleK.totalSupply()).toNumber(), tokensAmount.toNumber());
    });


    it('should not allow investors to buy tokens above tokenCap combined from both contracts in the 1st phase', async () => {
      await crowdsaleMain.diluteCaps();
      await crowdsaleK.diluteCaps();
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((tokenCap/1e18)/rate) + 1).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rate).mul(amountEth);

      await crowdsaleMain.buyTokens(INVESTORS, {value: amountEth.div(2), from: INVESTORS});

      //  buy tokens
      try {
        await crowdsaleK.buyTokens(INVESTORS, {value: amountEth.div(2), from: INVESTORS});
        assert.fail('should have failed before');
      } catch (error) {
        assertJump(error);
      }

      const vaultAddr = await crowdsaleMain.vault.call();
      const vaultBalance = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupply = await crowdsaleMain.totalSupply.call();
      assert.equal(vaultBalance.toNumber(), amountEth.div(2).toNumber(), 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount.div(2).toNumber(), 'balance still added for investor');
      assert.equal(totalSupply.toNumber(), tokensAmount.div(2).toNumber(), 'balance still added to totalSupply');

      // check readings from both contract
      assert.equal((await crowdsaleMain.weiRaisedIndividual()).toNumber(), (amountEth.div(2)).toNumber());
      assert.equal((await crowdsaleK.weiRaisedIndividual()).toNumber(), 0);

      assert.equal((await crowdsaleMain.weiRaised()).toNumber(), (amountEth.div(2)).toNumber());
      assert.equal((await crowdsaleK.weiRaised()).toNumber(), (amountEth.div(2)).toNumber());

      assert.equal((await crowdsaleMain.totalSupplyIndividual()).toNumber(), tokensAmount.div(2).toNumber());
      assert.equal((await crowdsaleK.totalSupplyIndividual()).toNumber(), 0);

      assert.equal((await crowdsaleMain.totalSupply()).toNumber(), tokensAmount.div(2).toNumber());
      assert.equal((await crowdsaleK.totalSupply()).toNumber(), tokensAmount.div(2).toNumber());
    });


    it('should deny refunds before end', async function () {
      await crowdsaleMain.diluteCaps();
      await crowdsaleK.diluteCaps();
      const INVESTOR = accounts[4];

      // buy tokens
      await crowdsaleMain.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});
      const vaultAddr = await crowdsaleMain.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(MOCK_ONE_ETH).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);

      //  claim refund
      try {
        await crowdsaleMain.claimRefund({from: INVESTOR});
        assert.fail('should have failed before');
      } catch (error) {
        assertJump(error);
      }

      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsaleMain.totalSupply.call();
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), 0, 'ether still deposited into the wallet');
    })

    it('should deny refunds after end if goal reached', async function () {
      await crowdsaleMain.diluteCaps();
      const INVESTOR = accounts[4];
      const amountEth = new BigNumber(goal/1e18).mul(MOCK_ONE_ETH);

      // buy tokens
      await crowdsaleMain.buyTokens(INVESTOR, {value: amountEth, from: INVESTOR});
      const vaultAddr = await crowdsaleMain.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(amountEth).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);
      await increaseTime(endTime - startTime + 1);
      await crowdsaleMain.finalize();

      //  claim refund
      try {
        await crowdsaleMain.claimRefund({from: INVESTOR});
        assert.fail('should have failed before');
      } catch (error) {
        assertJump(error);
      }

      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsaleMain.totalSupply.call();
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), amountEth, 'ether still deposited into the wallet');
    })

    it('should deny refunds after end if goal reached using crowdsaleK', async function () {
      await crowdsaleK.diluteCaps();
      await crowdsaleMain.diluteCaps();
      const INVESTOR = accounts[4];
      const amountEth = new BigNumber(goal/1e18).mul(MOCK_ONE_ETH);

      // buy tokens
      await crowdsaleK.buyTokens(INVESTOR, {value: amountEth, from: INVESTOR});
      const vaultAddr = await crowdsaleK.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(amountEth).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);
      await increaseTime(endTime - startTime + 1);
      await crowdsaleMain.finalize();

      //  claim refund
      try {
        await crowdsaleMain.claimRefund({from: INVESTOR});
        assert.fail('should have failed before');
      } catch (error) {
        assertJump(error);
      }

      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsaleMain.totalSupply.call();
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), amountEth, 'ether still deposited into the wallet');
    })

    it('should allow refunds after end if goal was not reached', async function () {
      await crowdsaleMain.diluteCaps();
      const INVESTOR = accounts[4];
      const amountEth = new BigNumber((goal/1e18) - 1).mul(MOCK_ONE_ETH);
      const investorEthBalanceBefore = await web3.eth.getBalance(INVESTOR);

      // buy tokens
      await crowdsaleMain.buyTokens(INVESTOR, {value: amountEth, from: INVESTOR, gasPrice: 0});
      const vaultAddr = await crowdsaleMain.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(amountEth).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);
      await increaseTime(endTime - startTime + 1);
      await crowdsaleMain.finalize();

      //  claim refund
      await crowdsaleMain.claimRefund({from: INVESTOR, gasPrice: 0});
      const investorEthBalanceAfter = await web3.eth.getBalance(INVESTOR);


      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsaleMain.totalSupply.call();
      assert.equal(investorEthBalanceAfter.sub(investorEthBalanceBefore).toNumber(), 0, 'ether still deposited into the wallet');
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
    })

    it('should allow refunds after end if goal was not reached when buying through crowdsaleK', async function () {
      await crowdsaleK.diluteCaps();
      const INVESTOR = accounts[4];
      const amountEth = new BigNumber((goal/1e18) - 1).mul(MOCK_ONE_ETH);
      const investorEthBalanceBefore = await web3.eth.getBalance(INVESTOR);

      // buy tokens
      await crowdsaleK.buyTokens(INVESTOR, {value: amountEth, from: INVESTOR, gasPrice: 0});
      const vaultAddr = await crowdsaleK.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(amountEth).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);
      await increaseTime(endTime - startTime + 1);
      await crowdsaleMain.finalize();

      //  claim refund
      await crowdsaleMain.claimRefund({from: INVESTOR, gasPrice: 0});
      const investorEthBalanceAfter = await web3.eth.getBalance(INVESTOR);


      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsaleMain.totalSupply.call();
      assert.equal(investorEthBalanceAfter.sub(investorEthBalanceBefore).toNumber(), 0, 'ether still deposited into the wallet');
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
    })

    it('should forward funds to wallet after end if goal was reached', async function () {
      await crowdsaleMain.diluteCaps();
      const INVESTOR = accounts[4];
      const amountEth = new BigNumber(goal/1e18).mul(MOCK_ONE_ETH);
      const walletBalanceBefore = await web3.eth.getBalance(multisigWallet.address);

      // buy tokens
      await crowdsaleMain.buyTokens(INVESTOR, {value: amountEth, from: INVESTOR});
      const vaultAddr = await crowdsaleMain.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(amountEth).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);
      await increaseTime(endTime - startTime + 1);
      await crowdsaleMain.finalize();

      //  claim refund
      const walletBalanceAfter = await web3.eth.getBalance(multisigWallet.address);
      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsaleMain.totalSupply.call();
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(walletBalanceAfter.sub(walletBalanceBefore).toNumber(), amountEth.toNumber(), 'balance still added for investor');
    });

    it('should forward funds to wallet after end if goal was reached using crowdsaleK', async function () {
      await crowdsaleK.diluteCaps();
      await crowdsaleMain.diluteCaps();
      const INVESTOR = accounts[4];
      const amountEth = new BigNumber(goal/1e18).mul(MOCK_ONE_ETH);
      const walletBalanceBefore = await web3.eth.getBalance(multisigWallet.address);

      // buy tokens
      await crowdsaleK.buyTokens(INVESTOR, {value: amountEth, from: INVESTOR});
      const vaultAddr = await crowdsaleK.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(amountEth).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);
      await increaseTime(endTime - startTime + 1);
      await crowdsaleMain.finalize();

      //  claim refund
      const walletBalanceAfter = await web3.eth.getBalance(multisigWallet.address);
      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsaleMain.totalSupply.call();
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(walletBalanceAfter.sub(walletBalanceBefore).toNumber(), amountEth.toNumber(), 'balance still added for investor');
    });
  })

  describe('#currentScenario', () => {

    it('should allow start crowdsaleMain properly', async () => {
    await advanceBlock();
    let startTime = latestTime();
    let endTime = startTime + 86400*14;
    let rate = 2125;
    let tokenCap = 2000000e18;
    let token = await Token.new();
    let multisigWallet = await MultisigWallet.new(FOUNDERS, 3, 10*MOCK_ONE_ETH);
    let dataCentre = await DataCentre.new();
    let controller = await Controller.new(token.address, dataCentre.address);
    let presale = await Presale.new(startTime, endTime, rate, multisigWallet.address, controller.address, tokenCap);
    await controller.addAdmin(presale.address);
    await token.transferOwnership(controller.address);
    await dataCentre.transferOwnership(controller.address);
    await controller.unpause();
    await controller.mint(accounts[0], 3800000e18);
    await presale.diluteCap();

    await presale.buyTokens(accounts[1], {value: 550*MOCK_ONE_ETH});

    assert.equal((await token.balanceOf(accounts[1])).toNumber(), rate*550*MOCK_ONE_ETH);
    assert.equal((await token.totalSupply()).toNumber(), rate*550*MOCK_ONE_ETH + 3800000e18);
    assert.equal((await presale.totalSupply()).toNumber(), rate*550*MOCK_ONE_ETH);
    assert.equal((await presale.weiRaised()).toNumber(), 550*MOCK_ONE_ETH);
    assert.equal((await web3.eth.getBalance(multisigWallet.address)).toNumber(), 550*MOCK_ONE_ETH);

    await increaseTime(endTime - startTime + 1);

    await advanceBlock();
    startTime = latestTime();
    endTime = startTime + 86400*31;
    rate = 1700;
    const goal = 750e18;
    tokenCap = 10000000e18;
    const crowdsaleMain = await CrowdsaleMain.new(startTime, endTime, rate, multisigWallet.address, controller.address, presale.address, tokenCap, goal);
    const vaultAddr = await crowdsaleMain.vault.call();
    const crowdsaleK = await CrowdsaleK.new(startTime, endTime, rate, multisigWallet.address, controller.address, presale.address, tokenCap, vaultAddr);

    await crowdsaleMain.setKico(crowdsaleK.address);
    await crowdsaleK.setMain(crowdsaleMain.address);
    await controller.removeAdmin(presale.address);
    await controller.addAdmin(crowdsaleMain.address);
    await controller.addAdmin(crowdsaleK.address);
    await crowdsaleMain.diluteCaps();
    await crowdsaleK.diluteCaps();

    await crowdsaleK.buyTokens(accounts[1], {value: 100*MOCK_ONE_ETH});
    await crowdsaleMain.buyTokens(accounts[1], {value: 100*MOCK_ONE_ETH});

    assert.equal((await token.balanceOf(accounts[1])).toNumber(), 2125*550*MOCK_ONE_ETH + rate*200*MOCK_ONE_ETH);
    assert.equal((await token.totalSupply()).toNumber(), 2125*550*MOCK_ONE_ETH + rate*200*MOCK_ONE_ETH + 3800000e18);
    assert.equal((await crowdsaleMain.totalSupplyIndividual()).toNumber(), rate*100*MOCK_ONE_ETH);
    assert.equal((await crowdsaleK.totalSupplyIndividual()).toNumber(), rate*100*MOCK_ONE_ETH);
    assert.equal((await crowdsaleMain.totalSupply()).toNumber(), rate*200*MOCK_ONE_ETH);
    assert.equal((await crowdsaleK.totalSupply()).toNumber(), rate*200*MOCK_ONE_ETH);

    assert.equal((await crowdsaleMain.weiRaisedIndividual()).toNumber(), 100*MOCK_ONE_ETH);
    assert.equal((await crowdsaleK.weiRaisedIndividual()).toNumber(), 100*MOCK_ONE_ETH);
    assert.equal((await crowdsaleMain.weiRaised()).toNumber(), 750*MOCK_ONE_ETH);
    assert.equal((await crowdsaleK.weiRaised()).toNumber(), 750*MOCK_ONE_ETH);

    assert.equal((await web3.eth.getBalance(vaultAddr)).toNumber(), 200*MOCK_ONE_ETH);

    await crowdsaleMain.extendEndTime(endTime + 60);
    await crowdsaleK.extendEndTime(endTime + 60);

    assert.equal((await crowdsaleMain.endTime.call()).toNumber(), endTime + 60);
    assert.equal((await crowdsaleK.endTime.call()).toNumber(), endTime + 60);

    await increaseTime(endTime - startTime + 61);
    await crowdsaleMain.finalize();

    assert.equal((await web3.eth.getBalance(multisigWallet.address)).toNumber(), 750*MOCK_ONE_ETH);
    });
  });
});
