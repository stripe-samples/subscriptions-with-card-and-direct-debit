<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use Stripe\Stripe;

require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

require './config.php';

$app = AppFactory::create();

// Add error middleware
$app->addErrorMiddleware(true, true, true);

// Create logger
$logger = new Monolog\Logger('app');
$logger->pushProcessor(new Monolog\Processor\UidProcessor());
$logger->pushHandler(new Monolog\Handler\StreamHandler(__DIR__ . '/logs/app.log', Monolog\Level::Debug));

// Middleware to set Stripe API key
$app->add(function (Request $request, $handler) {
    Stripe::setApiKey($_ENV['STRIPE_SECRET_KEY']);
    return $handler->handle($request);
});

$app->get('/', function (Request $request, Response $response, array $args) {
    $response->getBody()->write(file_get_contents('../../client/index.html'));
    return $response;
});

$app->get('/config', function (Request $request, Response $response, array $args) {
    $pub_key = $_ENV['STRIPE_PUBLISHABLE_KEY'];
    $plan_id = $_ENV['SUBSCRIPTION_PLAN_ID'];
    $plan = \Stripe\Plan::retrieve($plan_id);

    $response->getBody()->write(json_encode(['publishableKey' => $pub_key, 'plan' => $plan]));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/create-customer', function (Request $request, Response $response, array $args) {
    $plan_id = $_ENV['SUBSCRIPTION_PLAN_ID'];
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

    $response->getBody()->write(json_encode(['customer' => $customer, 'setupIntent' => $setup_intent]));
    return $response->withHeader('Content-Type', 'application/json');
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
                'plan' => $_ENV['SUBSCRIPTION_PLAN_ID'],
            ],
        ],
        'expand' => ['latest_invoice.payment_intent'],
    ]);

    $response->getBody()->write(json_encode($subscription));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/webhook', function (Request $request, Response $response) use ($logger) {
    $event = json_decode($request->getBody(), true);

    // Parse the message body (and check the signature if possible)
    $webhookSecret = $_ENV['STRIPE_WEBHOOK_SECRET'] ?? '';
    if ($webhookSecret) {
        try {
            $event = \Stripe\Webhook::constructEvent(
                $request->getBody(),
                $request->getHeaderLine('stripe-signature'),
                $webhookSecret
            );
        } catch (\Exception $e) {
            $response->getBody()->write(json_encode(['error' => $e->getMessage()]));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(403);
        }
    }

    $type = $event['type'];
    $object = $event['data']['object'];

    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    switch ($type) {
        case 'customer.created':
        case 'customer.updated':
        case 'setup_intent.created':
        case 'invoice.upcoming':
        case 'invoice.created':
        case 'invoice.finalized':
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
        case 'customer.subscription.created':
            $logger->info('Webhook received! ' . $type);
            break;
        default:
            // Unhandled event type
    }

    $response->getBody()->write(json_encode(['status' => 'success']));
    return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
});

$app->run();
