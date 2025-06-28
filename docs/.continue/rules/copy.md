---
description: copywriting
name: docs copy
---

# Copywriting Guidelines

## Keep It Clear and Concise

- Avoid unnecessary words. Get straight to the point.
- **Example:** Instead of *"Your cluster will start as soon as possible,"* say **"Launch instantly."**

## No Fluff or Marketing Speak

- Avoid phrases that sound overly promotional or vague.
- **Example:** Instead of *"Unlock the power of GPUs,"* say **"Deploy an H100 GPU cluster."**

## Action-Oriented Language

- Focus on what the user needs to do, not generic descriptions.
- **Example:** Instead of *"You will need the SF Compute CLI and kubectl,"* say **"Install @SF Compute CLI and @kubectl to access your cluster."**

## Consistent Formatting & Terminology

- Use the same terms across the app (e.g., **"Cluster Duration"** instead of sometimes saying **"Run Time"**).
- Use numerals for numbers (**"8 GPUs"**, not **"eight GPUs"**).

## Be Precise About Technical Details

- If something requires installation, say so.
- If a feature is unavailable, specify when it’s coming or provide an alternative.

## No Redundant Information

- Don't repeat what the user already knows.
- **Example:** Instead of *"You are placing an order for a K8s cluster,"* just tell them what they need to do next.

## Make Buttons and Actions Clear

- **"Place Order"** → **"Confirm Order"** (if payment isn’t immediate).
- **"Make Changes"** → **"Edit Order"** (for clarity).
- Buttons should be title casing

## Use a Neutral, Professional Tone

- Avoid overly casual language unless intentional.
- **Example:** Instead of *"Almost there! Just install this tool,"* say **"Install @SF Compute CLI and @kubectl to access your cluster."**

## Anticipate User Questions

- If something might be unclear, preemptively address it.
- **Example:** If persistent storage isn’t available yet, say **"Persistent storage (Coming soon). Contact us for alternatives."**

## Ensure UI Copy Feels Integrated

- Help text shouldn’t feel disconnected from the main UI.
- **Example:** If help text is too far from the relevant section, move it closer or embed it as a bullet point.

## Avoid Ambiguous Timeframes

- Be **precise** about when something will happen.
- **Example:** Instead of *"Your cluster will start shortly,"* say **"Your cluster will be ready in under 60 seconds."**

## Use User-Centered Language

- Focus on what **the user** needs, not what the system does.
- **Example:** Instead of *"The system will allocate GPUs,"* say **"Your cluster will have dedicated GPUs."**

## Don't Assume Prior Knowledge

- If using technical terms, **briefly explain or link to docs**.
- **Example:** Instead of *"Use InfiniBand networking,"* say **"Use InfiniBand networking (high-speed data transfer between nodes)."**

## Default to Positive Language

- Frame messages in an **encouraging, problem-solving way**, even for errors.
- **Example:** Instead of *"Your order failed,"* say **"Something went wrong—try again or contact support."**

## Minimize Distractions in Critical Actions

- During checkout or confirmations, **keep the user focused** by avoiding extra links or unnecessary text.
- **Example:** Instead of:
  > "You're about to place an order for a cluster. Did you know we also offer persistent storage? Contact us for more info."
  Use:
  > "Review your order details, then confirm your cluster setup."

## Write Error Messages That Guide Users

- Don’t just state **what went wrong—tell them how to fix it**.
- **Example:** Instead of *"Invalid API key,"* say **"Your API key is incorrect or expired. Generate a new key in your account settings."**

## Keep Confirmation Messages Clear & Reassuring

- After an action, let users know **what happens next**.
- **Example:** Instead of *"Your order was placed,"* say **"Your cluster is being deployed. You’ll receive access details shortly."**

## Keep Form Labels and Inputs Simple

- Labels should be **short and clear**.
- Placeholder text should **not repeat labels**.
- **Example:**
  - Bad *"Please enter your email address below:"*
  - Good **Label:** "Email" → **Input Placeholder:** "<you@example.com>"

## Ensure All Call-to-Action (CTA) Buttons Are Specific

- Every button should **describe the action it triggers**.
- **Example:**
  - Bad "Submit"
  - Good "Deploy Cluster"

  ## Keep It Short, but Not Cryptic

- Use the **fewest words possible** without losing clarity.
- **Example:** Instead of *"Your cluster is now being provisioned and will be available shortly,"* say **"Provisioning your cluster…"**
- Avoid unnecessary explanations—**the UI should guide users, not overwhelm them**.

## Prioritize Clarity Over Cleverness

- Avoid jargon unless your audience **already understands it**.
- **Example:** Instead of *"GPU nodes are booting up,"* say **"Your GPUs are starting up."**
- Don’t use technical terms **just to sound impressive**—only when they’re necessary.

## Show, Don’t Tell

- If an action **is already obvious from the UI**, **don’t repeat it**.
- **Example:** If there’s a "Deploy" button, **no need to add text saying "Click deploy to start your app."**
- Let **labels, buttons, and structure** guide the user instead of over-explaining.

## Use Sentence Case Everywhere

- Except for Buttons and Links.
- **Example:**
  - Bad *"Confirm Your Order"*
  - Good **"Confirm your order"**

## Error Messages Should Be Helpful, Not Alarming

- **Example:** Instead of *"Error 503: Something went wrong,"* say **"Server is temporarily unavailable. Try again in a few minutes."**
- Keep it **calm and constructive**—users shouldn’t feel like they broke something.

## CTA Buttons Should Be Actionable

- Buttons should **describe the action** clearly.
- **Example:**
  - Bad *"Submit"*
  - Good **"Deploy Cluster"**
  - Good **"Generate API Key"**
- Avoid vague labels like **"OK"** or **"Done"** if they can be more specific.

## Use Progressive Disclosure for Complex Information

- **Don’t overload users with details upfront.**
- Show advanced settings **only when needed**.
- **Example:** Instead of displaying **all API settings** immediately, add a **"Show advanced settings"** toggle.

## Default to a Professional, Neutral Tone

- Avoid sounding too **robotic** or too **casual**.
- **Example:** Instead of *"Oops! Something went wrong 😢,"* say **"We couldn't complete your request. Try again in a moment."**
- Keep personality **subtle**—Vercel and Linear add warmth through **clean design**, not excessive humor.

## Confirm Actions with Context

- **When users take an important action, confirm it.**
- **Example:** After deploying, instead of just closing the modal, show:
  > **"Your app has been deployed. View it live at @yourdomain.com."**
- This reassures users **something actually happened**.

## Avoid Passive Voice

- Make copy **direct and active**.
- **Example:**
  - Bad *"Your order has been placed."*
  - Good **"You placed your order."**
  - Bad *"Clusters are being deployed."*
  - Good **"Deploying your cluster…"**

## Keep the UI Copy Consistent

- If you call it **"Cluster Size"** in one place, **don’t call it "GPU Count" elsewhere**.
- Consistency builds **trust and usability**.

## Assume the User Knows What They’re Doing

- Don’t over-explain concepts **developers already understand**.
- **Example:** Instead of *"A Kubernetes cluster is a set of machines that…"*, just **link to docs**.
- Keep in-product copy **focused on action, not education**.

## If It’s Not Necessary, Remove It

- Every extra word **adds friction**.
- **Example:** Instead of *"Your cluster setup is now complete and you can start using it,"* say **"Your cluster is ready."**