# Resend Email Service Setup

This application uses Resend to send invitation emails when creating new user invites. Follow these steps to set up email functionality.

## 1. Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

## 2. Get Your API Key

1. Log in to your Resend dashboard
2. Go to "API Keys" section
3. Click "Create API Key"
4. Give it a name (e.g., "Leave Management System")
5. Copy the generated API key

## 3. Configure Domain (Optional but Recommended)

For production use, you should configure your own domain:

1. In Resend dashboard, go to "Domains"
2. Click "Add Domain"
3. Enter your domain (e.g., `yourdomain.com`)
4. Follow the DNS configuration instructions
5. Wait for domain verification

## 4. Update Environment Variables

Update your `.env.local` file with your Resend configuration:

```env
# Resend Email Configuration
RESEND_API_KEY=re_your_actual_api_key_here
FROM_EMAIL=noreply@yourdomain.com
```

**Important Notes:**
- Replace `re_your_actual_api_key_here` with your actual Resend API key
- If you haven't configured a custom domain, you can use `onboarding@resend.dev` as the FROM_EMAIL for testing
- For production, use your verified domain email address

## 5. Testing Email Functionality

### With Resend API Key Configured:
1. Go to User Management in the admin dashboard
2. Click "Invite User"
3. Fill in the user details
4. Submit the form
5. Check that the success message indicates "Email delivered to user"
6. The invited user should receive an email with their OTP code

### Without Resend API Key:
- The system will still create invites but won't send emails
- You'll see a message: "Invite created successfully! Email service not configured."
- The OTP code will be logged to the server console for testing

## 6. Email Template Features

The invitation email includes:
- **Professional HTML design** with your company branding
- **Clear OTP code** displayed prominently
- **Direct registration link** with pre-filled email
- **Expiration warning** with exact expiration time
- **Step-by-step instructions** for completing registration
- **Responsive design** that works on all devices

## 7. Invite Management Features

### Resend Invites:
- **When to use**: If user didn't receive the email or OTP expired
- **How it works**: Generates new OTP code, extends expiration by 24 hours, sends new email
- **Availability**: Only for pending (unused) invites that haven't expired

### Revoke Invites:
- **When to use**: If invite was sent by mistake or user no longer needs access
- **How it works**: Permanently deletes the invite from the system
- **Availability**: Only for unused invites (used invites cannot be revoked)

### Smart Action Buttons:
- **Resend**: Shows only for pending, non-expired invites
- **Revoke**: Shows for all unused invites
- **Used**: Shows for completed registrations (no actions available)

## 8. Registration Flow

When users receive the invitation email:
1. They click the registration link or visit `/register`
2. Enter their email and the OTP code from the email
3. Set up their password
4. Complete registration and get redirected to login

## 9. Troubleshooting

### Email Not Sending:
- Check that `RESEND_API_KEY` is correctly set in `.env.local`
- Verify the API key is valid in your Resend dashboard
- Check server logs for error messages

### Email Going to Spam:
- Configure SPF, DKIM, and DMARC records for your domain
- Use a verified domain instead of the default Resend domain
- Avoid spam trigger words in email content

### Domain Issues:
- Ensure your domain is verified in Resend dashboard
- Check DNS records are properly configured
- Wait up to 24 hours for DNS propagation

## 10. Production Considerations

For production deployment:
- Use a verified custom domain
- Set up proper DNS records (SPF, DKIM, DMARC)
- Monitor email delivery rates in Resend dashboard
- Consider setting up webhooks for delivery tracking
- Use environment-specific FROM_EMAIL addresses

## 11. Cost Information

Resend offers:
- **Free tier**: 3,000 emails/month
- **Pro tier**: $20/month for 50,000 emails
- **Enterprise**: Custom pricing for higher volumes

The free tier is sufficient for most small to medium organizations.
