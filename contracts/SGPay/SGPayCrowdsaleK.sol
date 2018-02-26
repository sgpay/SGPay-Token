pragma solidity ^0.4.11;

import '../crowdsale/singlestage/TokenCappedCrowdsale.sol';
import '../crowdsale/RefundVault.sol';
import '../ownership/Ownable.sol';

/**
 * @title SimpleCrowdsale
 * @dev This is an example of a fully fledged crowdsale.
 * The way to add new features to a base crowdsale is by multiple inheritance.
 * In order to switch between multistage and single stage, one must also change base contract import of the add-ons.
 * In this example we are providing following extensions:
 * TokenCappedCrowdsale - sets a max boundary for Token sold in milestones
 * RefundableCrowdsale - set a min goal to be reached and returns funds if it's not met
 * After adding multiple features it's good practice to run integration tests
 * to ensure that subcontracts works together as intended.
 */

 // _startTime - 1519898400
 // _endTime - 1522490400
 // _rate - 1700
 // _cap - 10000000e18
 // _goal - 1500e18

contract SGPayCrowdsaleK is TokenCappedCrowdsale, Ownable {

  RefundVault public vault;

  function SGPayCrowdsaleK(uint256 _startTime, uint256 _endTime, uint256 _rate, address _wallet, address controller, uint256 _cap, address _vaultAddr)
    Crowdsale(_startTime, _endTime, _rate, _wallet, controller)
    TokenCappedCrowdsale(_cap)
  {
    require(_vaultAddr != address(0));
    vault = RefundVault(_vaultAddr);
  }

  function setMain(address _complimentaryICO) public onlyOwner {
    complimentaryICO = _complimentaryICO;
  }

  function changeRate(uint256 _newValue) public onlyOwner {
    rate = _newValue;
  }

  function forwardFunds() internal {
    vault.deposit.value(msg.value)(msg.sender);
  }
}
