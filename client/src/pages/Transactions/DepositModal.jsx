import { Modal, Form, InputNumber, Input, message } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import DOMPurify from "dompurify";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  RequestPaypalVerificationCode, 
  VerifyPaypalDeposit, 
  VerifyDepositCode 
} from "../../api/transactions";
import { decryptData, encryptData } from "../../utils/cryptoUtils";

// Import sub-components
import PaymentMethodSelector from "../../components/Deposit/PaymentMethodSelector";
import StripeDepositForm from "../../components/Deposit/StripeDepositForm";
import PaypalDepositForm from "../../components/Deposit/PaypalDepositForm";
import VerificationCodeModal from "../../components/Deposit/VerificationCodeModal";

function DepositModal({ showDepositModal, setShowDepositModal, reloadData }) {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.users);
  const navigate = useNavigate();
  
  // State variables
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [paypalOrderId, setPaypalOrderId] = useState(null);
  const [showPaypalVerificationModal, setShowPaypalVerificationModal] = useState(false);
  const [paypalVerificationCode, setPaypalVerificationCode] = useState("");

  // Set the email value in the form when user data is available or when modal becomes visible
  useEffect(() => {
    if (user?.email && showDepositModal) {
      form.setFieldsValue({ 
        paypalEmail: user.email 
      });
    }
  }, [user, showDepositModal, form]);

  // Check for pending PayPal deposit when deposit modal opens
  useEffect(() => {
    if (showDepositModal && user?._id) {
      const encryptedPendingData = sessionStorage.getItem('pendingPayPalDeposit');
      if (encryptedPendingData) {
        try {
          // Decrypt the data
          const decryptedData = decryptData(encryptedPendingData);
          if (!decryptedData) {
            sessionStorage.removeItem('pendingPayPalDeposit');
            return;
          }
          
          const { orderId, amount, uid } = decryptedData;
          
          // Only show if for this user (expiration is already checked in decryptData)
          if (uid === user._id) {
            setPaypalOrderId(orderId);
            form.setFieldsValue({ amount });
            setShowPaypalVerificationModal(true);
          } else {
            // Clean up invalid data
            sessionStorage.removeItem('pendingPayPalDeposit');
          }
        } catch (error) {
          sessionStorage.removeItem('pendingPayPalDeposit');
        }
      }
    }
  }, [showDepositModal, user, form]);

  // Handle PayPal return with encrypted state and order ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderIdFromUrl = params.get("token");
    const encryptedState = params.get("state");
    
    if (params.get("paypal") === "success" && orderIdFromUrl) {
      try {
        // Decrypt and validate state
        const decryptedState = decryptData(decodeURIComponent(encryptedState));
        
        if (!decryptedState || 
            decryptedState.uid !== user._id || 
            Date.now() - decryptedState.ts > 3600000) {
          message.error("Invalid or expired session. Please try again.");
          navigate(window.location.pathname, { replace: true });
          return;
        }

        // Decrypt and verify stored order ID
        const encryptedStoredOrderId = sessionStorage.getItem('paypalOrderId');
        if (!encryptedStoredOrderId) {
          message.error("No order data found. Please try again.");
          navigate(window.location.pathname, { replace: true });
          return;
        }

        const decryptedOrderId = decryptData(encryptedStoredOrderId);
        if (!decryptedOrderId || decryptedOrderId !== orderIdFromUrl) {
          message.error("Order verification failed. Please try again.");
          navigate(window.location.pathname, { replace: true });
          return;
        }

        setPaypalOrderId(orderIdFromUrl);
        form.setFieldsValue({ amount: decryptedState.amount });
        message.success("Returned from PayPal. Please request your verification code to complete the deposit.");
        setShowPaypalVerificationModal(true);
        
        // Store pending PayPal deposit in sessionStorage for later recovery (encrypted)
        const pendingDepositData = {
          orderId: orderIdFromUrl,
          amount: decryptedState.amount,
          ts: Date.now(),
          uid: user._id
        };

        const encryptedPendingDeposit = encryptData(pendingDepositData);
        if (encryptedPendingDeposit) {
          sessionStorage.setItem('pendingPayPalDeposit', encryptedPendingDeposit);
        }
        
        // Clean up
        sessionStorage.removeItem('paypalOrderId');
        navigate(window.location.pathname, { replace: true });
      } catch (error) {
        message.error("Error processing PayPal return. Please try again.");
        navigate(window.location.pathname, { replace: true });
      }
    } else if (params.get("paypal") === "cancel") {
      message.info("PayPal deposit was cancelled.");
      sessionStorage.removeItem('paypalOrderId');
      navigate(window.location.pathname, { replace: true });
    }
  }, [navigate, form, user._id]);

  // Handler functions
  const handleVerifyCode = async () => {
    try {
      if (!verificationCode) {
        message.error("Please enter the verification code.");
        return;
      }

      // Verify the code entered by the user
      dispatch(ShowLoading());

      const response = await VerifyDepositCode({
        verificationCode,
        amount: form.getFieldValue("amount"),
      });

      dispatch(HideLoading());

      if (response.success) {
        reloadData(); // Reload data to reflect changes
        setShowDepositModal(false); // Close the deposit modal
        setShowVerificationModal(false); // Close the verification modal
        message.success("Deposit successful!");
      } else {
        message.error("Verification failed. Please check your code and try again.");
      }
    } catch (error) {
      dispatch(HideLoading());
      const sanitizedErrorMessage = DOMPurify.sanitize(error.message);
      message.error(sanitizedErrorMessage);
    }
  };

  // PayPal verification code handling
  const requestVerificationCode = async () => {
    try {
      if (!paypalOrderId) {
        message.error("No PayPal order found. Please try again.");
        return;
      }
      
      const email = form.getFieldValue("paypalEmail");
      
      dispatch(ShowLoading());
      
      // Now request the verification code to be sent via email
      const response = await RequestPaypalVerificationCode({
        userId: user._id,
        email,
        orderID: paypalOrderId
      });
      
      dispatch(HideLoading());
      
      if (response.success) {
        message.success("Verification code sent to your email. Please check and enter it below.");
      } else {
        message.error(response.message || "Failed to send verification code");
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(DOMPurify.sanitize(error.message));
    }
  };

  const handlePaypalVerifyCode = async () => {
    try {
      if (!paypalVerificationCode) {
        message.error("Please enter the verification code.");
        return;
      }

      const amount = form.getFieldValue("amount");
      if (!amount || amount <= 0) {
        message.error("Please enter a valid amount.");
        return;
      }

      dispatch(ShowLoading());

      const response = await VerifyPaypalDeposit({
        userId: user._id,
        verificationCode: paypalVerificationCode,
        amount: amount,
        orderID: paypalOrderId,
      });

      dispatch(HideLoading());
      if (response.success) {
        reloadData();
        setShowDepositModal(false);
        setShowPaypalVerificationModal(false);
        sessionStorage.removeItem('pendingPayPalDeposit');
        message.success("PayPal deposit successful!");
      } else {
        message.error(response.message || "Verification failed. Please check your code and try again.");
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(DOMPurify.sanitize(error.message));
    }
  };

  const handlePaypalOrderCreated = (orderId) => {
    setPaypalOrderId(orderId);
  };

  return (
    <>
      <Modal
        title="Deposit"
        open={showDepositModal}
        onCancel={() => setShowDepositModal(false)}
        footer={null}
      >
        <div className="flex-col gap-1">
          <Form layout="vertical" form={form}>
            <Form.Item
              label="Amount"
              name="amount"
              rules={[{ required: true, message: "Please input amount" }]}
            >
              <InputNumber min={1} controls={false} />
            </Form.Item>
            
          {paymentMethod === 'paypal' && (
            <Form.Item
              label="User Email for notification"
              name="paypalEmail"
              rules={[{ required: true, message: "Please input your PayPal email" }]}
            >              
              <Input />
            </Form.Item>
          )}

            <PaymentMethodSelector 
              paymentMethod={paymentMethod} 
              setPaymentMethod={setPaymentMethod} 
            />
            
            <div className="flex justify-end gap-1">
              <button
                className="primary-outlined-btn"
                onClick={() => setShowDepositModal(false)}
              >
                Cancel
              </button>
              
              {paymentMethod === 'stripe' && (
                <StripeDepositForm 
                  form={form} 
                  onDepositSuccess={() => setShowVerificationModal(true)} 
                />
              )}

              {paymentMethod === 'paypal' && (
                <PaypalDepositForm 
                  form={form} 
                  user={user} 
                  onPaypalOrderCreated={handlePaypalOrderCreated} 
                />
              )}
            </div>
          </Form>
        </div>
      </Modal>

      {/* Stripe verification modal */}
      <VerificationCodeModal
        isVisible={showVerificationModal}
        title="Enter Verification Code"
        onCancel={() => {
          setShowDepositModal(false);
          setShowVerificationModal(false);
        }}
        onVerify={handleVerifyCode}
        verificationCode={verificationCode}
        setVerificationCode={setVerificationCode}
      />

      {/* PayPal verification modal */}
      <VerificationCodeModal
        isVisible={showPaypalVerificationModal}
        title="Complete PayPal Deposit"
        onCancel={() => {
          setShowPaypalVerificationModal(false);
          setShowDepositModal(false);
        }}
        onVerify={handlePaypalVerifyCode}
        verificationCode={paypalVerificationCode}
        setVerificationCode={setPaypalVerificationCode}
        requestVerificationCode={requestVerificationCode}
        showRequestButton={true}
      />
    </>
  );
}

export default DepositModal;
