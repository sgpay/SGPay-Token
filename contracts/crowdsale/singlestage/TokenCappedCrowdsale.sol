pragma solidity ^0.4.11;

import './Crowdsale.sol';

/**
 * @title TokenCappedCrowdsale
 * @dev Extension of Crowdsale with a max amount of tokens to be bought
 */
contract TokenCappedCrowdsale is Crowdsale {

  uint256 public tokenCap;
  uint256 public totalSupplyIndividual;

  function totalSupply() public constant returns (uint256) {
    return totalSupplyIndividual.add(IComplimentary(complimentaryICO).totalSupplyIndividual());
  }

  function TokenCappedCrowdsale(uint256 _tokenCap) public {
      require(_tokenCap > 0);
      tokenCap = _tokenCap;
  }

  // low level token purchase function
  function buyTokens(address beneficiary) public payable {
    uint256 tokens = _buyTokens(beneficiary, rate);
    if(!setSupply(totalSupplyIndividual.add(tokens))) revert();
  }

  function setSupply(uint256 newSupply) internal constant returns (bool) {
    totalSupplyIndividual = newSupply;
    return tokenCap >= totalSupply();
  }

}
