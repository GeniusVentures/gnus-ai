Got it — that changes the answer.

If the child NFT is not only about expiry, but also about **private-network scope / tenant isolation / permissioning**, then yes: a child NFT per person/company/network can make sense.

The right framing is:

> The child NFT is not the “subscription clock.”  
> The child NFT is the **account / tenant / private-network license object**.  
> Expiry, credits, payment, and public/private bridging hang off that object.

That is a much better model than “one AI Credits token for everybody” if GNUS needs private network boundaries.

---

## Better model: child NFT as a private-network account/license

Think of the hierarchy like this:

```text
GNUS primary token / parent asset
└── GNUS AI product root
    ├── Company A AI Network License NFT
    │   ├── Company A monthly AI credits
    │   ├── Company A yearly AI credits
    │   └── Company A seats / operators / API users
    │
    ├── Company B AI Network License NFT
    │   ├── Company B monthly AI credits
    │   ├── Company B yearly AI credits
    │   └── Company B seats / operators / API users
    │
    └── Individual User AI License NFT
        └── User AI credits
```

So the company/person-specific child token is a **namespace**.

It can represent:

- private network membership,
- company tenant identity,
- API billing account,
- allowed compute network,
- public/private bridge permissions,
- subscription ownership,
- seats,
- credit policy,
- payment plan,
- KYC/BANXA relationship,
- public-chain settlement anchor.

That is a valid reason to have one child NFT per person/company.

---

## Important distinction

There are really three assets here:

### 1. Account / network license NFT

This is the private-network identity object.

Example:

```solidity
COMPANY_A_LICENSE_ID
```

It is probably:

```solidity
transferPolicy = SOULBOUND or ADMIN_TRANSFER_ONLY
expirationMode = PerHolder or PerTokenId
networkScope = private/public/hybrid
```

This token says:

> “This wallet/company/account is authorized to use GNUS AI under this private network scope.”

---

### 2. Spendable AI credits

These are what the system burns/spends when AI compute is used.

They can be child tokens under the license NFT:

```text
COMPANY_A_LICENSE_ID
└── COMPANY_A_AI_CREDITS_ID
```

These are likely:

```solidity
transferPolicy = SOULBOUND
expirationMode = PerHolder
disposition = BurnOnSpend / BurnOnExpire
```

---

### 3. Payment asset

This is separate:

- USDC
- GNUS in minions
- BANXA/card/fiat
- maybe later: internal private-network credits

Payment buys or renews the license/credits.

Do not make the payment token and the access/license token the same thing.

---

## The private/public network flow I would use

### Public chain = canonical billing and settlement layer

The public network should probably remain the canonical source for:

- USDC/GNUS payments,
- BANXA-confirmed purchases,
- company license creation,
- subscription renewal,
- treasury accounting,
- bridge events,
- auditability.

### Private network = execution / usage layer

The private network can handle:

- AI compute authorization,
- fast credit spending,
- API usage,
- private company-specific operations,
- private metadata,
- internal settlement,
- high-frequency burns.

Then the public network is used when needed for:

- payment,
- withdrawal,
- bridge-out,
- global verification,
- final settlement,
- company license proof.

---

## Suggested lifecycle

### Step 1: Company signs up

Company pays by USDC, GNUS, or BANXA.

```solidity
purchaseCompanyLicense(
    address companyAdmin,
    uint256 productId,
    PaymentToken paymentToken
)
```

Contract mints or activates:

```solidity
COMPANY_LICENSE_ID
```

with config:

```solidity
struct LicenseConfig {
    uint256 parentId;
    uint256 creditTokenId;
    uint256 publicMirrorId;
    uint256 privateNetworkId;
    address admin;
    address paymentRecipient;
    address verifier;
    uint64 validFrom;
    uint64 validUntil;
    ExpirationMode expirationMode;
    TransferPolicy transferPolicy;
    bool publicSettlementEnabled;
    bool privateNetworkEnabled;
}
```

---

### Step 2: Private network receives/mirrors the license

Either:

1. bridge the actual license token to the private network, or
2. keep canonical ownership public and mirror authorization privately.

For enterprise/private networks, I’d prefer **public canonical + private mirror**.

Public chain emits:

```solidity
LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt)
```

Private network reads/proves that event and activates local usage:

```solidity
activateMirroredLicense(
    licenseId,
    companyAdmin,
    expiresAt,
    proof
)
```

Now the company can use the private network.

---

### Step 3: Company/user consumes AI

The private network checks:

```solidity
isLicenseActive(licenseId)
isOperatorAllowed(licenseId, user)
hasSpendableCredits(licenseId, user or company)
```

Then usage burns or decrements credits privately.

```solidity
spendCredits(licenseId, account, amount)
```

---

### Step 4: Renewal

Renewal happens through the payment router.

For $5/month, $50/year, or whatever SKU:

```solidity
renewLicenseWithUSDC(licenseId, productId)
renewLicenseWithGNUS(licenseId, productId, maxGnusIn)
grantExternalPurchase(licenseId, productId, banxaPaymentId)
```

Renewal extends:

```solidity
expiresAt[licenseId][companyAdmin]
```

or updates:

```solidity
licenseValidUntil[licenseId]
```

depending on whether the license is per-holder or per-token.

For company licenses, I’d lean toward **per-token `validUntil`** because the company license itself is the account object. For user-level credits under it, use **per-holder expiry**.

---

## Where the $5 stable price fits

Use a `Product` or `Plan` registry. Do not hardcode pricing into the NFT itself.

```solidity
struct Product {
    uint256 licenseParentId;
    uint256 creditTokenTemplateId;
    uint256 priceUsd;        // 5_000_000 for $5.00 if 6 decimals
    uint256 creditAmount;
    uint64 duration;
    bool createsLicense;
    bool renewsLicense;
    bool active;
}
```

For payment in GNUS:

```solidity
gnusRequired = quoteUsdToGnusMinions(product.priceUsd)
```

For payment in USDC:

```solidity
usdcRequired = product.priceUsd
```

For BANXA:

```solidity
grantExternalPurchase(licenseId, productId, banxaPaymentId)
```

The purchase result is the same regardless of payment rail:

```text
Payment confirmed
→ license created or renewed
→ AI credits minted or extended
→ private network authorization updated
```

---

## Better object model

I’d describe the architecture like this:

```text
License NFT:
  who/what is allowed to use GNUS AI
  which private network it belongs to
  whether public settlement is allowed
  admin/operator policy
  expiry/subscription status

Credit token:
  how much AI usage is available
  spendable/burnable
  may expire per holder

Payment router:
  turns USDC/GNUS/BANXA payment into license renewal and/or credit minting

Bridge/mirror layer:
  lets private networks recognize public-chain licenses
  lets private usage settle back to public network when needed
```

---

## Example flow: company buys private network AI access

```text
1. Acme pays $5/month in USDC, GNUS, or BANXA.

2. Public PaymentRouter confirms payment.

3. Public hybrid token creates/mints:
   - Acme AI License NFT
   - Acme AI Credits child token or credit balance

4. Public event emitted:
   LicenseActivated(
     licenseId = 12345,
     privateNetworkId = GNUS_PRIVATE_ACME,
     expiresAt = Sep 5
   )

5. Private network mirrors license 12345.

6. Acme users call private GNUS AI endpoints.

7. Private network checks license 12345 and burns/decrements credits.

8. Renewal extends license and optionally tops up credits.

9. Public chain remains available for settlement, withdrawal, audit, or global portability.
```

---

## Should the company/person get their own child NFT?

For your use case, yes — but I’d be precise:

### Yes, one child NFT per company/person if it represents:

- account/license identity,
- private network scope,
- tenant isolation,
- billing relationship,
- bridge authority,
- API namespace,
- admin/operator permissions.

### No, do not create one child NFT per person/company merely for:

- monthly expiry,
- simple credits,
- ordinary balances.

In your case, because private network usage is part of the requirement, the child NFT has a real job.

---

## Public/private network policy fields

The token struct probably needs something like this appended:

```solidity
enum NetworkScope {
    PublicOnly,
    PrivateOnly,
    Hybrid
}

struct NFTInfo {
    string name;
    string symbol;
    string uri;
    uint256 exchangeRate;
    uint256 maxSupply;
    address creator;
    uint256 childCurIndex;

    TransferPolicy transferPolicy;
    Disposition disposition;
    ExpirationMode expirationMode;

    uint64 validFrom;
    uint64 validUntil;

    address expirationRecipient;
    address verifier;

    NetworkScope networkScope;
    uint256 privateNetworkId;
    bool publicSettlementEnabled;
}
```

For a company private-network license:

```solidity
networkScope = Hybrid
privateNetworkId = 101
publicSettlementEnabled = true
transferPolicy = SOULBOUND or ADMIN_TRANSFER_ONLY
expirationMode = PerTokenId
validUntil = subscriptionEnd
```

For the company’s AI credits:

```solidity
networkScope = PrivateOnly or Hybrid
privateNetworkId = 101
transferPolicy = SOULBOUND
expirationMode = PerHolder
disposition = BurnOnSpendOrExpire
```

---

## The key design call

I’d structure it as:

```text
Company/person child NFT = license/account/network namespace
Credits under that child NFT = usage units
Expiry = applied to license and/or credits depending on product
Payment = external router
Private/public portability = bridge or mirror layer
```

That gives GNUS a clean hybrid model:

- public chain for payment, audit, ownership, settlement,
- private chain for permissioned AI usage,
- child NFT for tenant/private-network identity,
- credits as expendable children under the license.

So yes, your instinct is right — the child NFT should probably exist. The adjustment is just: make it the **license/network account**, not the credit itself.