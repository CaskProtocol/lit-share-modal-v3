import React, {
  useEffect,
  useMemo,
  useState,
  Fragment
} from "react";
import { ShareModalContext } from "./createShareContext";

import LitJsSdk from "lit-js-sdk";
import { TOP_LIST } from "./helpers/topList";
import {
  humanizeNestedConditions,
  cleanUnifiedAccessControlConditions,
} from "./helpers/multipleConditionHelpers";
import LitHeader from "../reusableComponents/litHeader/LitHeader";
import SingleConditionSelect from "./singleConditionSelect/SingleConditionSelect";
import MultipleConditionSelect from "./multipleConditionSelect/MultipleConditionSelect";
import { defaultAllowedChainsObj } from "./helpers/shareModalDefaults";
import {
  checkPropTypes,
  getAllowedConditions,
  logDevError, setDevModeIsAllowed,
  stripNestedArray
} from "./helpers/helperFunctions.js";
import ReviewConditions from "./reviewConditions/ReviewConditions";
import LitConfirmationModal from "../reusableComponents/litConfirmationModal/LitConfirmationModal";
import DevModeHeader from "./devMode/DevModeHeader";
import DevModeContent from "./devMode/DevModeContent";

import "../index.css";
import "./ShareModal.css";
import "../shareModal/singleConditionSelect/SingleConditionSelect.css";
import "../shareModal/multipleConditionSelect/MultipleConditionSelect.css";
import './reviewConditions/ReviewConditions.css';
import "../reusableComponents/litChainSelector/LitChainSelector.css";
import "../reusableComponents/litHeader/LitHeader.css";
import "../reusableComponents/litChooseAccessButton/LitChooseAccessButton.css";
import '../reusableComponents/litReusableSelect/LitReusableSelect.css'
import '../reusableComponents/litInput/LitInput.css';
import '../reusableComponents/litFooter/LitFooter.css';
import '../reusableComponents/litFooter/LitBackButton.css';
import '../reusableComponents/litFooter/litNextButton.css';
import '../reusableComponents/litConfirmationModal/LitConfirmationModal.css';
import '../reusableComponents/litDeleteModal/LitDeleteModal.css';
import './multipleConditionSelect/MultipleAddCondition.css';
import '../reusableComponents/litCheckbox/LitCheckbox.css';

const ShareModal = (props) => {
  const [displayedPage, setDisplayedPage] = useState("single");
  const [error, setError] = useState(null);
  const [unifiedAccessControlConditions, setUnifiedAccessControlConditions] = useState([]);
  const [
    humanizedUnifiedAccessControlConditions,
    setHumanizedUnifiedAccessControlConditions,
  ] = useState([]);
  const [flow, setFlow] = useState("singleCondition");
  const [tokenList, setTokenList] = useState(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [chain, setChain] = useState(null);
  const [chainList, setChainList] = useState([]);
  const [showDevMode, setShowDevMode] = useState(false);

  const {
    onClose = () => false,
    onUnifiedAccessControlConditionsSelected,
    defaultTokens = TOP_LIST,
    defaultChain = 'ethereum',
    showChainSelector = true,
    allowMultipleConditions = true,
    permanentDefault = false,
    chainsAllowed = Object.keys(defaultAllowedChainsObj),
    conditionsAllowed = {},
    isModal = true,
    // TODO: unused props for v3
    allowDevMode = false,
  } = props;

  // TODO: prop setup
  useEffect(() => {
    checkPropTypes(props);

    setDevModeIsAllowed(allowDevMode);

    // check and set allowed conditions per chain
    const chainsWithAllowedConditions = getAllowedConditions(chainsAllowed, conditionsAllowed, defaultAllowedChainsObj);
    setChainList(chainsWithAllowedConditions);

    setInitialChain(chainsWithAllowedConditions)

    getTokens();
  }, [defaultChain]);

  const setInitialChain = async (chainsAllowed) => {
    // get default chain
    const initialChain = chainsAllowed.find(c => c.value === defaultChain);
    if (!initialChain) {
      logDevError('no default chain found.  Check defaultChain prop.')
      return;
    }
    await setChain(initialChain);
  }

  document.addEventListener("lit-ready", function (e) {
  }, false);

  // TODO: maybe keep functions below

  const getTokens = async () => {
    // get token list and cache it
    try {
      const tokens = await LitJsSdk.getTokenList();
      setTokenList(tokens);
    } catch (err) {
      setError(err)
    }
  };

  const handleDeleteAccessControlCondition = async (
    localIndex,
    nestedIndex
  ) => {
    const updatedAcc =unifiedAccessControlConditions;
    // TODO: create nested delete

    if (nestedIndex === null) {
      if (localIndex > 1 && localIndex === updatedAcc.length - 1) {
        updatedAcc.splice(-2);
      } else {
        updatedAcc.splice(updatedAcc[localIndex], 2);
      }
    } else {
      if (
        nestedIndex !== 0 &&
        nestedIndex === updatedAcc[localIndex].length - 1
      ) {
        updatedAcc[localIndex].splice(-2);
      } else {
        updatedAcc[localIndex].splice(updatedAcc[localIndex][nestedIndex], 2);
      }
    }

    await updateState(updatedAcc);

    if (updatedAcc.length === 0 && flow === "singleCondition") {
      setDisplayedPage("single");
    }
  };

  const checkForAddingOperatorToCondition = (
    acc,
    newAccessControlCondition
  ) => {
    const updatedAcc = acc;
    if (!acc.length && newAccessControlCondition[0]) {
      updatedAcc.push(newAccessControlCondition[0]);
    } else {
      updatedAcc.push({ operator: "and" });
      updatedAcc.push(newAccessControlCondition[0]);
    }
    return updatedAcc;
  };

  const handleUpdateUnifiedAccessControlConditions = async (
    newAccessControlCondition,
    isNested = false,
    index = null
  ) => {
    let updatedAcc = [...unifiedAccessControlConditions];
    if (!newAccessControlCondition[0]) {
      return;
    }

    if (isNested) {
      if (Array.isArray(updatedAcc[index])) {
        updatedAcc[index] = checkForAddingOperatorToCondition(
          updatedAcc[index],
          newAccessControlCondition
        );
      } else {
        let nestedUpdatedAcc = checkForAddingOperatorToCondition(
          [updatedAcc[index]],
          newAccessControlCondition
        );
        updatedAcc[index] = nestedUpdatedAcc;
      }
    } else {
      updatedAcc = checkForAddingOperatorToCondition(
        updatedAcc,
        newAccessControlCondition
      );
    }
    await updateState(updatedAcc);
  };

  const updateLogicOperator = async (value, localIndex, nestedIndex = null) => {
    let updatedAcc = [...unifiedAccessControlConditions];
    if (nestedIndex) {
      updatedAcc[localIndex][nestedIndex].operator = value;
    } else {
      updatedAcc[localIndex].operator = value;
    }

    await updateState(updatedAcc);
  };

  const updateState = async (acc) => {
    const cleanedAcc = cleanUnifiedAccessControlConditions(acc);
    const humanizedData = await humanizeNestedConditions([...cleanedAcc]);
    setHumanizedUnifiedAccessControlConditions([...humanizedData]);
    setUnifiedAccessControlConditions([...cleanedAcc]);
  };

  // TODO: functions for keeping


  const clearAllAccessControlConditions = () => {
    setUnifiedAccessControlConditions([]);
    setHumanizedUnifiedAccessControlConditions([]);
  };

  const handleClose = () => {
    if (unifiedAccessControlConditions.length) {
      setShowConfirmationModal(true);
    } else {
      resetModal();
      onClose();
    }
  };

  const resetModal = () => {
    setFlow("singleCondition");
    setDisplayedPage("single");
    clearAllAccessControlConditions();
    setError(null);
    setInitialChain(chainList).then(() => {});
  };

  const handleConfirmModalClose = (modalResponse) => {
    if (modalResponse === "yes") {
      resetModal();
      setShowConfirmationModal(false);
      onClose();
    } else {
      setShowConfirmationModal(false);
    }
  };

  const sendUnifiedAccessControlConditions = (conditionsArePermanent) => {
    const cleanedAccessControlConditions = stripNestedArray(unifiedAccessControlConditions);
    const keyParams = {
      unifiedAccessControlConditions: cleanedAccessControlConditions,
      permanent: !conditionsArePermanent,
      chain: 'ethereum'
    };
    // TODO: comment back in to export conditions
    onUnifiedAccessControlConditionsSelected(keyParams);
  };

  return (
    <div className={"lsm-light-theme lsm-share-modal-container"}>
      check
      {!error && (
        <ShareModalContext.Provider
          value={{
            handleUpdateUnifiedAccessControlConditions,
            handleDeleteAccessControlCondition,
            clearAllAccessControlConditions,
            updateLogicOperator,
            handleClose,
            sendUnifiedAccessControlConditions,
            resetModal,
            showChainSelector,
            chain,
            chainList,
            setChain,
            setError,
            setDisplayedPage,
            setFlow,
            humanizedUnifiedAccessControlConditions,
            unifiedAccessControlConditions,
            displayedPage,
            tokenList,
            flow,
            defaultTokens,
            allowMultipleConditions,
            permanentDefault
          }}
        >
          {allowDevMode ? (
            <DevModeHeader handleClose={handleClose}
                           isModal={isModal}
                           showDevMode={showDevMode}
                           setShowDevMode={setShowDevMode} />
            ) : (
            <LitHeader handleClose={handleClose} isModal={isModal} />
          )}
          {(allowDevMode && showDevMode) ? (
            <DevModeContent unifiedAccessControlConditions={unifiedAccessControlConditions} />
          ) : (
            <Fragment>
              {(flow === 'singleCondition' && displayedPage !== 'review') && (
                <SingleConditionSelect stepAfterUpdate={'review'} humanizedUnifiedAccessControlConditions={humanizedUnifiedAccessControlConditions} unifiedAccessControlConditions={unifiedAccessControlConditions}/>
              )}
              {(flow === 'multipleConditions' && displayedPage !== 'review') && (
                <MultipleConditionSelect humanizedUnifiedAccessControlConditions={humanizedUnifiedAccessControlConditions} unifiedAccessControlConditions={unifiedAccessControlConditions}/>
              )}
              {displayedPage === 'review' && (
                <ReviewConditions humanizedUnifiedAccessControlConditions={humanizedUnifiedAccessControlConditions} unifiedAccessControlConditions={unifiedAccessControlConditions} />
              )}
            </Fragment>
          )}
          <LitConfirmationModal
            message={"Are you sure you want to close the modal?"}
            showConfirmationModal={showConfirmationModal}
            onClick={handleConfirmModalClose}
          />
        </ShareModalContext.Provider>
      )}
      {error && (
        <span className={'lsm-error-display'}>
          <p className={'lsm-font-segoe lsm-text-brand-5'}>An error occurred with an external API:</p>
          <p className={'lsm-font-segoe'}>{error}</p>
          <p className={'lsm-font-segoe lsm-text-brand-5'}>Please close and reopen the modal to reconnect.</p>
          <button className={'lsm-error-button lsm-bg-brand-4'} onClick={onClose}>Close</button>
        </span>
      )}
    </div>
  );
};

export default ShareModal;
