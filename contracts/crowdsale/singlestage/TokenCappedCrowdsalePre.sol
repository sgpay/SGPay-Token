pragma solidity ^0.4.11;

import './CrowdsalePre.sol';

/**
 * @title TokenCappedCrowdsalePre
 * @dev Extension of Crowdsale with a max amount of tokens to be bought
 */
contract TokenCappedCrowdsalePre is CrowdsalePre {

  uint256 public tokenCap;
  uint256 public totalSupply;

  function TokenCappedCrowdsalePre(uint256 _tokenCap) public {
      require(_tokenCap > 0);
      tokenCap = _tokenCap;
  }

  // low level token purchase function
  function buyTokens(address beneficiary) public payable {
    uint256 tokens = _buyTokens(beneficiary, rate);
    if(!setSupply(totalSupply.add(tokens))) revert();
  }

  function setSupply(uint256 newSupply) internal constant returns (bool) {
    totalSupply = newSupply;
    return tokenCap >= totalSupply;
  }

}
