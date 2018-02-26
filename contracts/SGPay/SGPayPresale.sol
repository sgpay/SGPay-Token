pragma solidity ^0.4.11;

import '../crowdsale/singlestage/TokenCappedCrowdsalePre.sol';


/**
 * @title SimpleCrowdsale
 * @dev This is an example of a fully fledged crowdsale.
 * The way to add new features to a base crowdsale is by multiple inheritance.
 * In order to switch between multistage and single stage, one must also change base contract import of the add-ons.
 * In this example we are providing following extensions:
 * TokenCappedCrowdsalePre - sets a max boundary for Token sold in milestones
 * RefundableCrowdsale - set a min goal to be reached and returns funds if it's not met
 * After adding multiple features it's good practice to run integration tests
 * to ensure that subcontracts works together as intended.
 */

 // _startTime - 1517479200
 // _endTime - 1518602400
 // _rate - 2125
 // _cap - 2000000e18

contract SGPayPresale is TokenCappedCrowdsalePre {


  function SGPayPresale(uint256 _startTime, uint256 _endTime, uint256 _rate, address _wallet, address controller, uint256 _cap)
    CrowdsalePre(_startTime, _endTime, _rate, _wallet, controller)
    TokenCappedCrowdsalePre(_cap)
  {
    // require(_cap.div(rate) > _goal);
  }

  function changeRate(uint256 _newValue) public onlyController {
    rate = _newValue;
  }
}
