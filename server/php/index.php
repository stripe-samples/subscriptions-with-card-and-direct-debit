<?php
use Slim\Http\Request;
use Slim\Http\Response;
use Stripe\Stripe;
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::create(__DIR__);
$dotenv->load();


require './config.php';

$app = new \Slim\App;

// Instantiate the logger as a dependency
$container = $app->getContainer();
$container['logger'] = function ($c) {
  $settings = $c->get('settings')['logger'];
  $logger = new Monolog\Logger($settings['name']);
  $logger->pushProcessor(new Monolog\Processor\UidProcessor());
  $logger->pushHandler(new Monolog\Handler\StreamHandler(__DIR__ . '/logs/app.log', \Monolog\Logger::DEBUG));
  return $logger;
};
$app->add(function ($request, $response, $next) {
    Stripe::setApiKey(getenv('STRIPE_SECRET_KEY'));
    return $next($request, $response);
});

$app->get('/', function (Request $request, Response $response, array $args) {   
  // Display checkout page
  return $response->write(file_get_contents('../../client/index.html'));
});

$app->get('/config', function (Request $request, Response $response, array $args) {
  $pub_key = getenv('STRIPE_PUBLISHABLE_KEY');
  $plan_id = getenv('SUBSCRIPTION_PLAN_ID');
  $plan = \Stripe\Plan::retrieve($plan_id);
  
  return $response->withJson(['publishableKey' => $pub_key, 'plan' => $plan]);
});

$app->post('/create-customer', function (Request $request, Response $response, array $args) {  
  $plan_id = getenv('SUBSCRIPTION_PLAN_ID');
  $body = json_decode($request->getBody());
  
  // Create a new customer object
  $customer = \Stripe\Customer::create([
    'name' => $body->name,
    'email' => $body->email
  ]);
  
  // Create a SetupIntent to set up our payment methods recurring usage
  $setup_intent = \Stripe\SetupIntent::create([
    'payment_method_types' => ['card', 'au_becs_debit'],
    'customer' => $customer['id']
  ]);

  return $response->withJson(['customer' => $customer, 'setupIntent' => $setup_intent]);
});

$app->post('/subscription', function (Request $request, Response $response, array $args) {  
  $body = json_decode($request->getBody());

  // Set the default payment method on the customer
  \Stripe\Customer::update($body->customerId, [
    'invoice_settings' => [
      'default_payment_method' => $body->paymentMethodId
    ]
  ]);
  // Create the subscription
  $subscription = \Stripe\Subscription::create([
    'customer' => $body->customerId,
    'items' => [
      [
        'plan' => getenv('SUBSCRIPTION_PLAN_ID'),
      ],
    ],
    'expand' => ['latest_invoice.payment_intent'],
  ]);

  return $response->withJson($subscription);
});


$app->post('/webhook', function(Request $request, Response $response) {
    $logger = $this->get('logger');
    $event = $request->getParsedBody();
    // Parse the message body (and check the signature if possible)
    $webhookSecret = getenv('STRIPE_WEBHOOK_SECRET');
    if ($webhookSecret) {
      try {
        $event = \Stripe\Webhook::constructEvent(
          $request->getBody(),
          $request->getHeaderLine('stripe-signature'),
          $webhookSecret
        );
      } catch (\Exception $e) {
        return $response->withJson([ 'error' => $e->getMessage() ])->withStatus(403);
      }
    } else {
      $event = $request->getParsedBody();
    }
    $type = $event['type'];
    $object = $event['data']['object'];

    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    // Remove comment to see the various objects sent for this sample
    switch ($type) {
      case 'customer.created':
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'customer.updated':
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'setup_intent.created':
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'invoice.upcoming':
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'invoice.created':
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'invoice.finalized':
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'invoice.payment_succeeded':
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'invoice.payment_failed':
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'customer.subscription.created':
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      // ... handle other event types
      default:
        // Unhandled event type
    }

    return $response->withJson([ 'status' => 'success' ])->withStatus(200);
});

$app->run();
