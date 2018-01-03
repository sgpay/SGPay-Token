pragma solidity ^0.4.11;

import "../../contracts/crowdsale/singlestage/TokenCappedCrowdsale.sol";
import "../../contracts/crowdsale/RefundableCrowdsale.sol";


/**
 * @title SampleCrowdsale
 * @dev This is an example of a fully fledged crowdsale.
 * The way to add new features to a base crowdsale is by multiple inheritance.
 * In this example we are providing following extensions:
 * HardCappedCrowdsale - sets a max boundary for raised funds
 * RefundableCrowdsale - set a min goal to be reached and returns funds if it's not met
 *
 * After adding multiple features it's good practice to run integration tests
 * to ensure that subcontracts works together as intended.
 */
contract MockSimpleCrowdsale is Crowdsale, TokenCappedCrowdsale, RefundableCrowdsale {


  function MockSimpleCrowdsale(uint256 _startTime, uint256 _endTime, uint256 _rate, address _wallet, address controller, uint256 _cap, uint256 _goal)
  Crowdsale(_startTime, _endTime, _rate, _wallet, controller)
  TokenCappedCrowdsale(_cap)
  RefundableCrowdsale(_goal)
  {

  }

  function diluteCaps() public {
    // diluting all caps by 10^6 for testing
    tokenCap = tokenCap.div(1e6);
    goal = goal.div(1e6);

  }
}
