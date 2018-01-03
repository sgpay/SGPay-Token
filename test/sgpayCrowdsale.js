const Controller = artifacts.require('./controller/Controller.sol');
const Presale = artifacts.require('./mocks/MockSGPayPresale.sol');
const Crowdsale = artifacts.require('./mocks/MockSGPayCrowdsale.sol');
const MockWallet = artifacts.require('./mocks/MockWallet.sol');
const Token = artifacts.require('./crowdsale/SGPay.sol');
const MultisigWallet = artifacts.require('./multisig/solidity/MultiSigWalletWithDailyLimit.sol');
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
    controller = await Controller.new(token.address, '0x00')
    presale = await Presale.new(startTime, endTime, rate, multisigWallet.address, controller.address, tokenCap);
    await controller.addAdmin(presale.address);
    await token.transferOwnership(controller.address);
    await controller.unpause();
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
    let crowdsale;
    let endTime;
    let startTime;

    beforeEach(async () => {
      await advanceBlock();
      startTime = latestTime();
      endTime = startTime + 86400*31;
      rate = 1700;
      goal = 1500e18;
      tokenCap = 10000000e18;
      crowdsale = await Crowdsale.new(startTime, endTime, rate, multisigWallet.address, controller.address, tokenCap, goal);
      await controller.removeAdmin(presale.address);
      await controller.addAdmin(crowdsale.address);
    });

    it('should allow start crowdsale properly', async () => {
    // checking startTime
    const startTimeSet = await crowdsale.startTime.call();
    assert.equal(startTime, startTimeSet.toNumber(), 'startTime not set right');

    //checking initial token distribution details
    const initialBalance = await token.balanceOf.call(accounts[0]);
    assert.equal(3800000e18, initialBalance.toNumber(), 'initialBalance for sale NOT distributed properly');

    //checking token and wallet address
    const tokenAddress = await controller.satellite.call();
    const walletAddress = await crowdsale.wallet.call();
    assert.equal(tokenAddress, token.address, 'address for token in contract not set');
    assert.equal(walletAddress, multisigWallet.address, 'address for multisig wallet in contract not set');

    //list rate and check
    const rate = await crowdsale.rate.call();
    const endTime = await crowdsale.endTime.call();
    const tokenCapSet = await crowdsale.tokenCap.call();
    const goal = await crowdsale.goal.call();

    assert.equal(goal.toNumber(), goal, 'tokenCap not set');
    assert.equal(tokenCapSet.toNumber(), tokenCap, 'tokenCap not set');
    assert.equal(endTime.toNumber(), endTime, 'endTime not set right');
    assert.equal(rate.toNumber(), rate, 'rate not set right');
    });

    it('should not allow to start crowdsale if endTime smaller than startTime',  async () => {
      let crowdsaleNew;
      endTime = startTime - 1;
      try {
        crowdsaleNew = await Crowdsale.new(startTime, endTime, rate, multisigWallet.address, controller.address, tokenCap, goal);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleNew, undefined, 'crowdsale still initialized');
    });

    it('should not allow to start crowdsale due to ZERO rate',  async () => {
      let crowdsaleNew;
      try {
        crowdsaleNew = await Crowdsale.new(startTime, endTime, 0, multisigWallet.address, controller.address, tokenCap, goal);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleNew, undefined, 'crowdsale still initialized');
    });

    it('should not allow to start crowdsale if cap is zero',  async () => {
      let crowdsaleNew;
      try {
        crowdsaleNew = await Crowdsale.new(startTime, endTime, rate, multisigWallet.address, controller.address, 0, goal);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleNew, undefined, 'crowdsale still initialized');
    });

    it('should not allow to start crowdsale if goal is zero',  async () => {
      let crowdsaleNew;
      try {
        crowdsaleNew = await Crowdsale.new(startTime, endTime, rate, multisigWallet.address, controller.address, tokenCap, 0);
        assert.fail('should have failed before');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleNew, undefined, 'crowdsale still initialized');
    });

    it('should allow investors to buy tokens at the constant swapRate', async () => {
      const INVESTOR = accounts[4];

      // buy tokens
      await crowdsale.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});
      const vaultAddr = await crowdsale.vault.call();
      const vaultBalance = await web3.eth.getBalance(vaultAddr);
      const tokensBalance = await token.balanceOf.call(INVESTOR);

      const tokensAmount = new BigNumber(MOCK_ONE_ETH).mul(rate);
      assert.equal(vaultBalance.toNumber(), MOCK_ONE_ETH, 'ether not deposited into the wallet');
      assert.equal(tokensBalance.toNumber(), tokensAmount.toNumber(), 'tokens not deposited into the INVESTOR balance');
    });


    it('should allow investors to buy tokens just below tokenCap in the 1st phase', async () => {
      await crowdsale.diluteCaps();
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((tokenCap/1e18)/rate) - 1).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rate).mul(amountEth);

      //  buy tokens
      await crowdsale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      const vaultAddr = await crowdsale.vault.call();
      const vaultBalance = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupply = await crowdsale.totalSupply.call();

      assert.equal(vaultBalance.toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount.toNumber(), 'balance still added for investor');
      assert.equal(totalSupply.toNumber(), tokensAmount.toNumber(), 'balance not added to totalSupply');
    });

    it('should allow investors to buy tokens just equal to tokenCap in the 1st phase', async () => {
      await crowdsale.diluteCaps();
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((tokenCap/1e18)/rate)).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rate).mul(amountEth);

      //  buy tokens
      await crowdsale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      const vaultAddr = await crowdsale.vault.call();
      const vaultBalance = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupply = await crowdsale.totalSupply.call();

      assert.equal(vaultBalance.toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount.toNumber(), 'balance still added for investor');
      assert.equal(totalSupply.toNumber(), tokensAmount.toNumber(), 'balance not added to totalSupply');
    });


    it('should not allow investors to buy tokens above tokenCap in the 1st phase', async () => {
      await crowdsale.diluteCaps();
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((tokenCap/1e18)/rate) + 1).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rate).mul(amountEth);

      //  buy tokens
      try {
        await crowdsale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
        assert.fail('should have failed before');
      } catch (error) {
        assertJump(error);
      }

      const vaultAddr = await crowdsale.vault.call();
      const vaultBalance = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupply = await crowdsale.totalSupply.call();
      assert.equal(vaultBalance.toNumber(), 0, 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), 0, 'balance still added for investor');
      assert.equal(totalSupply.toNumber(), 0, 'balance still added to totalSupply');
    });


    it('should deny refunds before end', async function () {
      await crowdsale.diluteCaps();
      const INVESTOR = accounts[4];

      // buy tokens
      await crowdsale.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});
      const vaultAddr = await crowdsale.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(MOCK_ONE_ETH).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);

      //  claim refund
      try {
        await crowdsale.claimRefund({from: INVESTOR});
        assert.fail('should have failed before');
      } catch (error) {
        assertJump(error);
      }

      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsale.totalSupply.call();
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), 0, 'ether still deposited into the wallet');
    })

    it('should deny refunds after end if goal reached', async function () {
      await crowdsale.diluteCaps();
      const INVESTOR = accounts[4];
      const amountEth = new BigNumber(goal/1e18).mul(MOCK_ONE_ETH);

      // buy tokens
      await crowdsale.buyTokens(INVESTOR, {value: amountEth, from: INVESTOR});
      const vaultAddr = await crowdsale.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(amountEth).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);
      await increaseTime(endTime - startTime + 1);
      await crowdsale.finalize();

      //  claim refund
      try {
        await crowdsale.claimRefund({from: INVESTOR});
        assert.fail('should have failed before');
      } catch (error) {
        assertJump(error);
      }

      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsale.totalSupply.call();
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), amountEth, 'ether still deposited into the wallet');
    })

    it('should allow refunds after end if goal was not reached', async function () {
      await crowdsale.diluteCaps();
      const INVESTOR = accounts[4];
      const amountEth = new BigNumber((goal/1e18) - 1).mul(MOCK_ONE_ETH);
      const investorEthBalanceBefore = await web3.eth.getBalance(INVESTOR);

      // buy tokens
      await crowdsale.buyTokens(INVESTOR, {value: amountEth, from: INVESTOR, gasPrice: 0});
      const vaultAddr = await crowdsale.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(amountEth).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);
      await increaseTime(endTime - startTime + 1);
      await crowdsale.finalize();

      //  claim refund
      await crowdsale.claimRefund({from: INVESTOR, gasPrice: 0});
      const investorEthBalanceAfter = await web3.eth.getBalance(INVESTOR);


      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsale.totalSupply.call();
      assert.equal(investorEthBalanceAfter.sub(investorEthBalanceBefore).toNumber(), 0, 'ether still deposited into the wallet');
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
    })

    it('should forward funds to wallet after end if goal was reached', async function () {
      await crowdsale.diluteCaps();
      const INVESTOR = accounts[4];
      const amountEth = new BigNumber(goal/1e18).mul(MOCK_ONE_ETH);
      const walletBalanceBefore = await web3.eth.getBalance(multisigWallet.address);

      // buy tokens
      await crowdsale.buyTokens(INVESTOR, {value: amountEth, from: INVESTOR});
      const vaultAddr = await crowdsale.vault.call();
      const tokensBalance = await token.balanceOf.call(INVESTOR);
      const tokensAmount = new BigNumber(amountEth).mul(rate);
      const vaultBalanceBefore = await web3.eth.getBalance(vaultAddr);
      await increaseTime(endTime - startTime + 1);
      await crowdsale.finalize();

      //  claim refund
      const walletBalanceAfter = await web3.eth.getBalance(multisigWallet.address);
      const vaultBalanceAfter = await web3.eth.getBalance(vaultAddr);
      const balanceInvestor = await token.balanceOf.call(INVESTOR);
      const totalSupply = await crowdsale.totalSupply.call();
      assert.equal(vaultBalanceBefore.sub(vaultBalanceAfter).toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(walletBalanceAfter.sub(walletBalanceBefore).toNumber(), amountEth.toNumber(), 'balance still added for investor');
    });
  })
})
