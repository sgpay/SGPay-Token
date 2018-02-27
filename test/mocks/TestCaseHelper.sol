pragma solidity ^0.4.11;


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
contract TestCaseHelper {
  uint256 public constant totalSupplyIndividual = 0;
  uint256 public constant weiRaisedIndividual = 0;
  uint256 public constant weiRaised = 0;
}
