package com.stripe.sample;

import static spark.Spark.get;
import static spark.Spark.port;
import static spark.Spark.post;
import static spark.Spark.staticFiles;

import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Customer;
import com.stripe.model.Plan;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.Invoice;
import com.stripe.model.StripeObject;
import com.stripe.model.SetupIntent;
import com.stripe.param.SetupIntentCreateParams;
import com.stripe.model.Subscription;
import com.stripe.net.Webhook;

import io.github.cdimascio.dotenv.Dotenv;

public class Server {
    private static Gson gson = new Gson();

    static class CreateCustomerBody {
        @SerializedName("name")
        String name;
        @SerializedName("email")
        String email;

        public String getName() {
            return name;
        }

        public String getEmail() {
            return email;
        }
    }

    static class CreateSubscriptionBody {
        @SerializedName("customerId")
        String customerId;
        
        @SerializedName("paymentMethodId")
        String paymentMethodId;

        public String getCustomerId() {
            return customerId;
        }

        public String getPaymentMethodId() {
            return paymentMethodId;
        }
    }

    public static void main(String[] args) {
        port(4242);
        Dotenv dotenv = Dotenv.load();
        Stripe.apiKey = dotenv.get("STRIPE_SECRET_KEY");

        staticFiles.externalLocation(
                Paths.get(Paths.get("").toAbsolutePath().toString(), dotenv.get("STATIC_DIR")).normalize().toString());

        get("/config", (request, response) -> {
            response.type("application/json");
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("publishableKey", dotenv.get("STRIPE_PUBLISHABLE_KEY"));
            Plan plan = Plan.retrieve(dotenv.get("SUBSCRIPTION_PLAN_ID"));
            responseData.put("plan", plan);
            return gson.toJson(responseData);
        });

        post("/create-customer", (request, response) -> {
            response.type("application/json");

            CreateCustomerBody postBody = gson.fromJson(request.body(), CreateCustomerBody.class);
            // Create a new customer object
            Map<String, Object> customerParams = new HashMap<String, Object>();
            customerParams.put("name", postBody.getName());
            customerParams.put("email", postBody.getEmail());
            Customer customer = Customer.create(customerParams);

            // Create a SetupIntent to set up our payment methods recurring usage
            SetupIntentCreateParams setupIntentParams = new SetupIntentCreateParams.Builder()
                    .addPaymentMethodType("card")
                    .addPaymentMethodType("au_becs_debit")
                    .setCustomer(customer.getId())
                    .build();
            SetupIntent setupIntent = SetupIntent.create(setupIntentParams);

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("customer", customer);
            responseData.put("setupIntent", setupIntent);
            return gson.toJson(responseData);
        });

        post("/subscription", (request, response) -> {
            response.type("application/json");
            // Set the default payment method on the customer
            CreateSubscriptionBody postBody = gson.fromJson(request.body(), CreateSubscriptionBody.class);
            Customer customer = Customer.retrieve(postBody.getCustomerId());

            Map<String, Object> customerParams = new HashMap<String, Object>();
            Map<String, String> invoiceSettings = new HashMap<String, String>();
            invoiceSettings.put("default_payment_method", postBody.getPaymentMethodId());
            customerParams.put("invoice_settings", invoiceSettings);
            customer.update(customerParams);

            // Create the subscription
            Map<String, Object> item = new HashMap<>();
            item.put("plan", dotenv.get("SUBSCRIPTION_PLAN_ID"));
            Map<String, Object> items = new HashMap<>();
            items.put("0", item);
            Map<String, Object> params = new HashMap<>();
            params.put("customer", postBody.getCustomerId());
            params.put("items", items);
            Subscription subscription = Subscription.create(params);

            return gson.toJson(subscription);
        });

        post("/webhook", (request, response) -> {
            String payload = request.body();
            String sigHeader = request.headers("Stripe-Signature");
            String endpointSecret = dotenv.get("STRIPE_WEBHOOK_SECRET");
            Event event = null;

            try {
                event = Webhook.constructEvent(payload, sigHeader, endpointSecret);
            } catch (SignatureVerificationException e) {
                // Invalid signature
                response.status(400);
                return "";
            }

            // Deserialize the nested object inside the event
            EventDataObjectDeserializer dataObjectDeserializer = event.getDataObjectDeserializer();
            StripeObject stripeObject = null;
            if (dataObjectDeserializer.getObject().isPresent()) {
                stripeObject = dataObjectDeserializer.getObject().get();
            } else {
                // Deserialization failed, probably due to an API version mismatch.
                // Refer to the Javadoc documentation on `EventDataObjectDeserializer` for
                // instructions on how to handle this case, or return an error here.
            }

            switch (event.getType()) {
            case "customer.created":
                // Customer customer = (Customer) stripeObject;
                // System.out.println(customer.toJson());
                break;
            case "customer.updated":
                // Customer customer = (Customer) stripeObject;
                // System.out.println(customer.toJson());
                break;
            case "invoice.upcoming":
                // Invoice invoice = (Invoice) stripeObject;
                // System.out.println(invoice.toJson());
                break;
            case "invoice.created":
                // Invoice invoice = (Invoice) stripeObject;
                // System.out.println(invoice.toJson());
                break;
            case "invoice.finalized":
                // Invoice invoice = (Invoice) stripeObject;
                // System.out.println(invoice.toJson());
                break;
            case "invoice.payment_succeeded":
                // Invoice invoice = (Invoice) stripeObject;
                // System.out.println(invoice.toJson());
                break;
            case "invoice.payment_failed":
                // Invoice invoice = (Invoice) stripeObject;
                // System.out.println(invoice.toJson());
                break;
            case "customer.subscription.created":
                Subscription subscription = (Subscription) stripeObject;
                System.out.println(subscription.toJson());
                break;
            default:
                // Unhandled event type
            }

            response.status(200);
            return "";
        });
    }
}