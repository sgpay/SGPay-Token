pragma solidity ^0.4.11;

import '../token/Token.sol';


/**
 Simple Token based on OpenZeppelin token contract
 */
contract SGPay is Token {

  string public constant name = "SGPay";
  string public constant symbol = "SGP";
  uint8 public constant decimals = 18;
  uint256 public constant INITIAL_SUPPLY = 3800000 * (10 ** uint256(decimals));

}
