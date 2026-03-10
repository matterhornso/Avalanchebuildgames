// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/PredictionMarket.sol";

contract PredictionMarketTest is Test {
    PredictionMarket pm;
    address resolver = makeAddr("resolver");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        pm = new PredictionMarket();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_createMarket() public {
        uint256 id = pm.createMarket("Test?", block.timestamp + 1 days, resolver);
        PredictionMarket.Market memory m = pm.getMarket(id);
        assertEq(m.question, "Test?");
        assertEq(m.resolver, resolver);
        assertFalse(m.resolved);
    }

    function test_placeBet() public {
        uint256 id = pm.createMarket("Test?", block.timestamp + 1 days, resolver);

        vm.prank(alice);
        pm.placeBet{value: 1 ether}(id, PredictionMarket.Outcome.Yes);

        PredictionMarket.Market memory m = pm.getMarket(id);
        assertEq(m.yesPool, 1 ether);
        assertEq(m.noPool, 0);
    }

    function test_resolveAndClaim() public {
        uint256 id = pm.createMarket("Test?", block.timestamp + 1 days, resolver);

        vm.prank(alice);
        pm.placeBet{value: 2 ether}(id, PredictionMarket.Outcome.Yes);

        vm.prank(bob);
        pm.placeBet{value: 1 ether}(id, PredictionMarket.Outcome.No);

        vm.prank(resolver);
        pm.resolveMarket(id, PredictionMarket.Outcome.Yes);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        pm.claimPayout(id);

        // Alice bet 2 of 2 in yes pool, total pool is 3, payout = (2*3)/2 = 3
        assertEq(alice.balance - balBefore, 3 ether);
    }

    function test_revert_betAfterDeadline() public {
        uint256 id = pm.createMarket("Test?", block.timestamp + 1 days, resolver);
        vm.warp(block.timestamp + 2 days);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketNotActive.selector);
        pm.placeBet{value: 1 ether}(id, PredictionMarket.Outcome.Yes);
    }

    function test_revert_claimBeforeResolved() public {
        uint256 id = pm.createMarket("Test?", block.timestamp + 1 days, resolver);

        vm.prank(alice);
        pm.placeBet{value: 1 ether}(id, PredictionMarket.Outcome.Yes);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketNotActive.selector);
        pm.claimPayout(id);
    }

    function test_revert_doubleClaim() public {
        uint256 id = pm.createMarket("Test?", block.timestamp + 1 days, resolver);

        vm.prank(alice);
        pm.placeBet{value: 1 ether}(id, PredictionMarket.Outcome.Yes);

        vm.prank(resolver);
        pm.resolveMarket(id, PredictionMarket.Outcome.Yes);

        vm.startPrank(alice);
        pm.claimPayout(id);
        vm.expectRevert(PredictionMarket.AlreadyClaimed.selector);
        pm.claimPayout(id);
        vm.stopPrank();
    }

    function test_loserCannotClaim() public {
        uint256 id = pm.createMarket("Test?", block.timestamp + 1 days, resolver);

        vm.prank(bob);
        pm.placeBet{value: 1 ether}(id, PredictionMarket.Outcome.No);

        vm.prank(resolver);
        pm.resolveMarket(id, PredictionMarket.Outcome.Yes);

        vm.prank(bob);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        pm.claimPayout(id);
    }
}
