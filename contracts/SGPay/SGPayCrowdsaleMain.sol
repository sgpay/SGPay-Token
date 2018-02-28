pragma solidity ^0.4.11;

import '../crowdsale/singlestage/TokenCappedCrowdsale.sol';
import '../crowdsale/RefundableCrowdsale.sol';


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

contract SGPayCrowdsaleMain is TokenCappedCrowdsale, RefundableCrowdsale {

  function SGPayCrowdsaleMain(uint256 _startTime, uint256 _endTime, uint256 _rate, address _wallet, address controller, address _presale, uint256 _cap, uint256 _goal)
    Crowdsale(_startTime, _endTime, _rate, _wallet, controller)
    TokenCappedCrowdsale(_cap)
    RefundableCrowdsale(_goal)
  {
    require(_presale != address(0));
    presaleAddr = _presale;
    // require(_cap.div(rate) > _goal);
  }

  function setKico(address _complimentaryICO) public onlyOwner {
    complimentaryICO = _complimentaryICO;
  }

  function extendEndTime(uint256 _endTime) public onlyOwner {
    require(_endTime > endTime);
    endTime = _endTime;
  }

  function changeRate(uint256 _newValue) public onlyOwner {
    rate = _newValue;
  }
}
