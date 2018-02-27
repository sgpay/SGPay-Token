pragma solidity ^0.4.11;

import '../SafeMath.sol';
import '../controller/ControllerInterface.sol';

contract IComplimentary {
  uint256 public totalSupplyIndividual;
  uint256 public weiRaisedIndividual;
  uint256 public weiRaised;
}

/**
 * @title Crowdsale
 * @dev CrowdsaleBase is a base contract for managing a token crowdsale.
 * All crowdsales contracts must inherit this contract.
 */

contract CrowdsaleBase {
  using SafeMath for uint256;

  address public controller;
  uint256 public startTime;
  address public wallet;
  uint256 public weiRaisedIndividual;
  address public presaleAddr;
  uint256 public endTime;
  address public complimentaryICO;

  event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

  function CrowdsaleBase(uint256 _startTime, address _wallet, address _controller) public {
    require(_wallet != address(0));

    controller = _controller;
    startTime = _startTime;
    wallet = _wallet;
  }

  function weiRaised() public constant returns (uint256) {
    return weiRaisedIndividual.add(IComplimentary(complimentaryICO).weiRaisedIndividual()).add(IComplimentary(presaleAddr).weiRaised());
  }

  function buyTokens(address beneficiary) public payable;

  // @return true if crowdsale event has ended
  function hasEnded() public constant returns (bool) {
    return now > endTime;
  }

  // fallback function can be used to buy tokens
  function () external payable {
    buyTokens(msg.sender);
  }

  // send ether to the fund collection wallet
  // override to create custom fund forwarding mechanisms
  function forwardFunds() internal {
    require(wallet.call.gas(2000).value(msg.value)());
  }

  // @return true if the transaction can buy tokens
  function validPurchase() internal constant returns (bool) {
    bool withinPeriod = now >= startTime && now <= endTime;
    bool nonZeroPurchase = msg.value != 0;
    return withinPeriod && nonZeroPurchase;
  }

  // low level token purchase function
  function _buyTokens(address beneficiary, uint256 rate) internal returns (uint256 tokens) {
    require(beneficiary != address(0));
    require(validPurchase());

    uint256 weiAmount = msg.value;

    // calculate token amount to be created
    tokens = weiAmount.mul(rate);

    // update state
    weiRaisedIndividual = weiRaisedIndividual.add(weiAmount);

    ControllerInterface(controller).mint(beneficiary, tokens);
    TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

    forwardFunds();
  }

}
