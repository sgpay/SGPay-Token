pragma solidity ^0.4.11;


import '../../contracts/crowdsale/RefundableCrowdsale.sol';


contract RefundableCrowdsaleImpl is RefundableCrowdsale {

  function RefundableCrowdsaleImpl (uint256 _startTime, uint256 _endTime, uint256 _rate, address _wallet, address _controller, address _presale, uint256 _goal) public
    Crowdsale(_startTime, _endTime, _rate, _wallet, _controller)
    RefundableCrowdsale(_goal)
  {
    presaleAddr = _presale;
  }

  function setComplimentary(address _complimentaryICO) public {
    complimentaryICO = _complimentaryICO;
  }
}
