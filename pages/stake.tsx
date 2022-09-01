import { useAddress, useMetamask } from "@thirdweb-dev/react";
import { ethers } from "ethers";
import type { NextPage } from "next";
import React, { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
import usdcVaultJSON from "../src/utils/USDCVaultLogic.json";
import ERC20JSON from "../src/utils/ERC20.json";
import { Web3Provider } from "@ethersproject/providers";

const Stake: NextPage = () => {
  // Ethers
  const [provider, setProvider] = useState<Web3Provider>();
  const signer = provider?.getSigner();
  const [tokenBalance, setTokenBalance] = useState({
    symbol: "",
    tvl: 0,
    multisig: 0,
    displayValue: 0,
  });

  // Wallet Connection Hooks
  const address = useAddress();
  const connectWithMetamask = useMetamask();
  const decimal = 6;
  // Contract Hooks
  const PROXY = new ethers.Contract(
    process.env.NEXT_PUBLIC_PROXY_ADDRESS!,
    usdcVaultJSON.abi,
    signer
  );
  const ERC20 = new ethers.Contract(
    process.env.NEXT_PUBLIC_USDC_ADDRESS!,
    ERC20JSON.abi,
    signer
  );
  ///////////////////////////////////////////////////////////////////////////
  // Custom contract functions
  ///////////////////////////////////////////////////////////////////////////
  const [claimableRewards, setClaimableRewards] = useState<Number>();
  const [claimableTime, setclaimableTime] = useState<Date>();
  const [deposit, setDeposit] = useState(0);
  useEffect(
    () => setProvider(new Web3Provider(window.ethereum as any)),
    [address]
  );

  useEffect(() => {
    if (!address) return;
    async function loadExpireTime() {
      const expireTime = await PROXY?.timelock(1);
      setclaimableTime(new Date(expireTime.toNumber() * 1000));
    }

    loadExpireTime();
  }, [address]);

  useEffect(() => {
    if (!address) return;
    console.log(address);
    async function loadERC20() {
      const symbol = await ERC20?.symbol();
      const displayValue = await ERC20?.balanceOf(address);
      const multisig = await ERC20?.balanceOf(
        process.env.NEXT_PUBLIC_MULTISIG_ADDRESS
      );
      const tvl = await PROXY?.balanceOf();
      setTokenBalance({
        symbol: symbol,
        tvl: tvl.div(1e6).toNumber(),
        multisig: multisig.div(1e6).toNumber(),
        displayValue: displayValue.div(1e6).toNumber(),
      });
    }

    async function loadClaimableRewards() {
      const cr = await PROXY?.claimableOf(address);
      console.log("Loaded claimable rewards", cr.toNumber() / 1e6);
      setClaimableRewards(cr.toNumber() / 1e6);
    }

    loadERC20();
    loadClaimableRewards();
  }, [address, deposit, claimableRewards]);

  ///////////////////////////////////////////////////////////////////////////
  // Write Functions
  ///////////////////////////////////////////////////////////////////////////
  async function stake() {
    if (!address) return;
    const allowance = await ERC20?.allowance(address, PROXY?.address);
    // If not approved, request approval
    if (allowance.toString() === "0") {
      const approve = await ERC20?.approve(
        PROXY?.address,
        ethers.constants.MaxUint256.toString()
      );
      await approve.wait();
    }
    const tx = await PROXY?.stake(
      ethers.utils.parseUnits(deposit.toString(), decimal)
    );
    await tx.wait();
    setDeposit(0);
  }

  async function withdraw() {
    const withdraw = await PROXY?.withdraw();
    const multisig = await ERC20?.balanceOf(
      process.env.NEXT_PUBLIC_MULTISIG_ADDRESS
    );
    await withdraw.wait();
    setTokenBalance((prevState) => {
      return { ...prevState, multisig: multisig.div(1e6).toNumber() };
    });
  }

  async function claimRewards() {
    const claim = await PROXY?.claim();
    await claim.wait();
    setClaimableRewards(0);
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.h1}>InVar USDC Vault</h1>

      {!address ? (
        <button className={styles.mainButton} onClick={connectWithMetamask}>
          Connect Wallet
        </button>
      ) : (
        <>
          <div className={styles.tokenGrid}>
            <div className={styles.tokenItem}>
              <h3 className={styles.tokenLabel}>TVL</h3>
              <p className={styles.tokenValue}>
                <b>{tokenBalance?.tvl}</b> {tokenBalance?.symbol}
              </p>
            </div>
            <div className={styles.tokenItem}>
              <h3 className={styles.tokenLabel}>MultiSig</h3>
              <p className={styles.tokenValue}>
                <b>{tokenBalance?.multisig}</b> {tokenBalance?.symbol}
              </p>
            </div>
          </div>

          <button
            className={`${styles.mainButton} ${styles.spacerTop}`}
            onClick={() => withdraw()}
          >
            Withdraw to Multisig
          </button>

          <hr className={`${styles.divider} ${styles.spacerTop}`} />

          <h2>Your Tokens</h2>
          <div className={styles.tokenGrid}>
            <div className={styles.tokenOverview}>
              <h3 className={styles.tokenLabel}>Claimable Time</h3>
              <p className={styles.tokenValue}>
                <b>
                  {!claimableTime ? "Loading..." : claimableTime.toString()}
                </b>{" "}
              </p>
              <h3 className={styles.tokenLabel}>Claimable Rewards</h3>
              <p className={styles.tokenValue}>
                <b>{!claimableRewards ? 0 : claimableRewards}</b>{" "}
                {tokenBalance?.symbol}
              </p>
              <button
                className={`${styles.mainButton}`}
                onClick={() => claimRewards()}
              >
                Claim
              </button>
            </div>
            <div className={styles.tokenOverview}>
              <h3 className={styles.tokenLabel}>Current Balance</h3>
              <p className={styles.tokenValue}>
                <b>{tokenBalance?.displayValue}</b> {tokenBalance?.symbol}
              </p>
              <hr className={`${styles.divider}`} />

              <h3 className={styles.tokenLabel}>Staking Amount</h3>
              <p className={styles.tokenValue}>
                <b>
                  <input
                    className={styles.textInput}
                    value={deposit}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setDeposit(Number(event.target.value))
                    }
                  />
                </b>{" "}
                {tokenBalance?.symbol}
              </p>
              <button
                className={`${styles.mainButton}`}
                onClick={() => stake()}
              >
                Stake
              </button>
            </div>
          </div>
          <hr className={`${styles.divider} ${styles.spacerTop}`} />
        </>
      )}
    </div>
  );
};

export default Stake;
