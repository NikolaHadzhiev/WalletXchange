import { useState } from "react";
import { message, Modal, Form, Input } from "antd";
import { useDispatch } from "react-redux";
import { loadStripe } from "@stripe/stripe-js";
import { CardElement, Elements, useStripe, useElements } from "@stripe/react-stripe-js";
import { DepositMoney } from "../../api/transactions";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import DOMPurify from "dompurify";

// Load Stripe outside of component rendering to avoid recreating Stripe object
const stripePromise = loadStripe("pk_test_51P8KILJu27FG0r8818B58hMz1ejeheU6F84tFUXtmcvkRgc4ofbw2zEejUwPTTE38LoqB4GZZBiCVCieIBjkRTXW00fqLAGsNI");

// Card form styling
const cardStyle = {
  style: {
    base: {
      color: "#32325d",
      fontFamily: 'Arial, sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#aab7c4",
      },
    },
    invalid: {
      color: "#fa755a",
      iconColor: "#fa755a",
    },
  },
};

// Checkout form component with card validation
const CheckoutForm = ({ form, onDepositSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const dispatch = useDispatch();
  const [errorMessage, setErrorMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const handleCardChange = (event) => {
    setErrorMessage(event.error ? event.error.message : "");
    setCardComplete(event.complete);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Validate amount
    const amount = form.getFieldValue("amount");
    if (!amount || amount <= 0) {
      message.error("Please enter a valid amount.");
      return;
    }

    if (!stripe || !elements || !cardComplete) {
      // Stripe.js has not loaded yet, or card details are incomplete
      setErrorMessage("Please complete the card information.");
      return;
    }

    setProcessing(true);
    dispatch(ShowLoading());

    try {
      // Create a payment method with the card details
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
        billing_details: {
          name: form.getFieldValue("name") || "Card Holder",
          email: form.getFieldValue("email") || "",
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setProcessing(false);
        dispatch(HideLoading());
        return;
      }

      // Create a token format similar to what your backend expects
      const token = {
        id: paymentMethod.id,
        email: form.getFieldValue("email") || "",
        card: {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
        }
      };      // Send to backend
      const response = await DepositMoney({
        token,
        amount,
      });

      // Look for error messages in the appropriate field
      const errorData = response.data ? DOMPurify.sanitize(response.data) : null;
      const errorMessage = DOMPurify.sanitize(response.message);

      if (response.success) {
        onDepositSuccess(); // Show verification modal
        message.success(errorMessage);
        setErrorMessage("");
        elements.getElement(CardElement).clear();
      } else {
        // If there's data in the response, prioritize showing that as the error
        if (errorData) {
          message.error(errorData);
          setErrorMessage(errorData);
        } else {
          message.error(errorMessage);
          setErrorMessage(errorMessage);
        }
      }
    } catch (error) {
      const sanitizedErrorMessage = DOMPurify.sanitize(error.message);
      setErrorMessage(sanitizedErrorMessage);
      message.error(sanitizedErrorMessage);
    } finally {
      setProcessing(false);
      dispatch(HideLoading());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stripe-form">
      <Form.Item label="Name on Card" name="name">
        <Input placeholder="Card holder name" />
      </Form.Item>
      
      <Form.Item label="Email" name="email">
        <Input placeholder="Email for receipt" />
      </Form.Item>
      
      <div className="card-element-container" style={{ padding: '10px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
        <CardElement options={cardStyle} onChange={handleCardChange} />
      </div>
      
      {errorMessage && (
        <div className="card-error" style={{ color: 'red', marginTop: '10px' }}>
          {errorMessage}
        </div>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <button 
          type="submit"
          className="primary-contained-btn"
          disabled={!stripe || processing || !cardComplete}
        >
          {processing ? "Processing..." : "Deposit"}
        </button>
      </div>
    </form>
  );
};

// Main StripeDepositForm component
const StripeDepositForm = ({ form, onDepositSuccess }) => {
  const [showStripeModal, setShowStripeModal] = useState(false);

  return (
    <>
      <button 
        className="primary-contained-btn" 
        onClick={() => {
          const amount = form.getFieldValue("amount");
          if (!amount || amount <= 0) {
            message.error("Please enter a valid amount.");
            return;
          }
          setShowStripeModal(true);
        }}
      >
        Deposit with Card
      </button>

      <Modal
        title="Card Payment"
        open={showStripeModal}
        onCancel={() => setShowStripeModal(false)}
        footer={null}
        destroyOnClose={true}
      >
        <Elements stripe={stripePromise}>
          <CheckoutForm form={form} onDepositSuccess={() => {
            onDepositSuccess();
            setShowStripeModal(false);
          }} />
        </Elements>
      </Modal>
    </>
  );
};

export default StripeDepositForm;
