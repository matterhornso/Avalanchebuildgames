// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/PredictionMarket.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address resolver = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        PredictionMarket pm = new PredictionMarket();

        uint256 oneMonth = block.timestamp + 30 days;
        uint256 threeMonths = block.timestamp + 90 days;
        uint256 sixMonths = block.timestamp + 180 days;

        pm.createMarket("Will AVAX reach $100 by end of Q2 2026?", threeMonths, resolver);
        pm.createMarket("Will Ethereum complete the Pectra upgrade by June 2026?", threeMonths, resolver);
        pm.createMarket("Will Bitcoin hit $150k in 2026?", sixMonths, resolver);
        pm.createMarket("Will Avalanche TVL exceed $5B by April 2026?", oneMonth, resolver);
        pm.createMarket("Will the US pass a stablecoin regulation bill in 2026?", sixMonths, resolver);
        pm.createMarket("Will NFT trading volume surpass $2B monthly by Q3 2026?", sixMonths, resolver);
        pm.createMarket("Will a major centralized exchange get hacked in 2026?", sixMonths, resolver);
        pm.createMarket("Will Avalanche launch 100+ L1s on its network by mid 2026?", threeMonths, resolver);
        pm.createMarket("Will DeFi total TVL exceed $300B by end of 2026?", sixMonths, resolver);
        pm.createMarket("Will a country adopt Bitcoin as legal tender in 2026?", sixMonths, resolver);

        vm.stopBroadcast();

        console.log("PredictionMarket deployed to:", address(pm));
    }
}
