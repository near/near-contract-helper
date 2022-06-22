const nodemailer = require('nodemailer');

const sendMail = async (options, emitEmailSentEvent) => {
    if (process.env.NODE_ENV == 'production') {
        const transport = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD
            }
        });
        return transport.sendMail({
            from: process.env.WALLET_EMAIL || 'wallet@near.org',
            ...options
        });
    } else {
        emitEmailSentEvent(options);
    }
};

const getSecurityCodeEmail = (accountId, securityCode) => template({
    title: 'Verify Your Device',
    contentPreview: `Your NEAR Wallet security code is: ${securityCode}`,
    content: [{
        html: 'Your NEAR Wallet security code is:',
    },
    {
        blockquote: true,
        html: securityCode
    }, {
        html: 'Enter this code to verify your device.',
    }],
});

const getNewAccountEmail = (accountId, recoverUrl, securityCode) => template({
    title: 'Welcome to NEAR Wallet',
    contentPreview: `This message contains your account activation code and recovery link for ${accountId}.`,
    content: [{
        html: `This message contains your account activation code and recovery link for <b>${accountId}</b>. Keep this Email safe, and <strong>DO NOT SHARE IT!</strong> <span style="color:#DF2626;">We cannot resend this Email.</span>`
    },
    {
        html: '1. Confirm your activation code to finish creating your account:'
    },
    {
        blockquote: true,
        html: securityCode
    },
    {
        html: `2. In the event that you need to recover your account, click the link below, and follow the directions in NEAR Wallet.
      `
    }, {
        html: `<a href="${recoverUrl}">Recover my Account</a>`
    }],
});

const get2faHtml = (securityCode, requestDetails, fakConfig = {}) => {
    const content = [{
        html: 'Important: By entering this code, you are authorizing the following transaction:'
    }];

    if (fakConfig.public_key) {
        content.push({
            blockquote: true,
            html: `<strong>WARNING: entering this code will authorize full access to your NEAR account: "${ fakConfig.accountId }". If you did not initiate this action DO NOT continue.</strong>`
        }, {
            html: 'This should only be done if you are adding a new seed phrase to your account. In all other cases, this is very dangerous.'
        }, {
            html: `The public key you are adding is: ${ fakConfig.public_key }`
        }, {
            html: `If you'd like to proceed, enter the security code: ${securityCode}`
        });
    } else {
        content.push({
            html: requestDetails.join('<br>\n'),
        });
    }

    content.push({
        blockquote: true,
        html: securityCode
    });

    return template({
        title: 'NEAR Wallet Transaction Request',
        contentPreview: `NEAR Wallet transaction request code: ${securityCode}`,
        content,
    });
};

const template = ({
    title = 'Sample Title',
    contentPreview = 'This Email is a sample',
    content = [
        {
            html: 'This will show up first as a <p></p> tag element.'
        },
        {
            blockquote: true,
            html: 'This will look like a blockquote with centered blue text for showing important things.'
        },
    ],
    buttonLabel,
    buttonLink
}) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta content="width=device-width, user-scalable=yes, initial-scale=1.0" name="viewport">
    <title>NEAR Wallet</title>
    <style>
      html {
        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
  
      body {
        width: 100% !important;
        height: 100% !important;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
        -webkit-text-size-adjust: none;
        background: #25272A url('https://storage.googleapis.com/near-contract-helper/email-background.png') no-repeat;
        background-size: contain;
      }
  
      a {
        color: #0B70CE;
      }
  
      a:hover,
      a:active {
        opacity: .9;
      }
  
      img {
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
        -ms-interpolation-mode: bicubic;
      }
  
      table {
        border-collapse: collapse !important;
      }
  
      #outlook a {
        padding: 0; /* Force Outlook to provide a "view in browser" message */
      }
  
      .ReadMsgBody {
        width: 100%;
      }
  
      .ExternalClass {
        width: 100%; /* Force Hotmail to display emails at full width */
      }
  
      .ExternalClass,
      .ExternalClass p,
      .ExternalClass span,
      .ExternalClass font,
      .ExternalClass td,
      .ExternalClass div {
        line-height: 100%; /* Force Hotmail to display normal line spacing */
      }
  
      body, table, td, p, a, li, blockquote {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
  
      table, td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }
  
      a img {
        border: none;
      }
  
      table td {
        border-collapse: collapse;
        padding: 0;
      }
  
      /* Page style */
      .normal-font-family {
        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      }
  
      h1,
      h2,
      h3,
      h4 {
        font-weight: 700;
        margin: 30px 0 16px;
      }
  
      h1 {
        font-size: 24px;
      }
  
      h2 {
        font-size: 20px;
      }
  
      h3, h4 {
        font-size: 16px;
      }
  
      ol {
        margin: 1em 0;
        padding-left: 40px;
        list-style: decimal;
      }
  
      .md-content a {
        color: #0B70CE !important;
      }
  
      .table-container {
        width: 640px;
      }
  
      .main-container-sidebar-column {
        width: 80px;
      }
  
      .table-container + div > div {
        border: none !important;
        padding-top: 0 !important;
      }
  
      /* Responsive */
      @media only screen and (max-width: 640px) {
        .table-container {
          width: 96%;
        }
  
        .main-container-sidebar-column {
          width: 20px;
        }

        .email-action {
          width: 100%;
        }
      }
    </style>
  </head>
  <body style="width: 100% !important;
      height: 100% !important;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: none;
      background: #25272A url('https://storage.googleapis.com/near-contract-helper/email-background.png') no-repeat;
      background-size: contain;"
  >
    <!-- The Email client preview part goes here -->
    <div style="display:none; font-size:1px; color:#333; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${ contentPreview}
    </div>
    <table class="table-container" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td height="40"></td>
      </tr>
      <tr>
        <td align="center">
          <a href="https://near.org/" target="_blank" title="NEAR Protocol">
            <img src="https://storage.googleapis.com/near-contract-helper/near-wallet-logo.png" height="40" width="140">
          </a>
        </td>
      </tr>
      <tr>
        <td height="20"></td>
      </tr>
    </table>
    <table class="table-container" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td height="20"></td>
      </tr>
      <tr>
        <td>
          <table style="background-color:#fff; border-radius:8px;">
            <tr>
              <td class="main-container-sidebar-column"></td>
              <td>
                <table>
                  <tr>
                    <td height="60"></td>
                  </tr>
                  <tr>
                    <td align="center">
                      <img src="https://storage.googleapis.com/near-contract-helper/near-phone-icon.png" alt="Phone Icon" width="72">
                    </td>
                  </tr>
                  <tr>
                    <td height="20"></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:28px; color:#25272A; font-weight:700;"
                        class="normal-font-family">
                      <!-- The title goes here -->
                      <span>${ title}</span>
                    </td>
                  </tr>
                  <tr>
                    <td height="20"></td>
                  </tr>
                  <tr>
                    <!-- The content goes here -->
                    <td style="font-size:16px; color:#3b3b3b; line-height:24px;" class="normal-font-family md-content">
                        ${ content.map(({ blockquote, html }) => blockquote ?
        `<p><span style="background:#F6F6F6; border-radius:5px; color:#0B70CE; display:block; font-size:18px; font-weight:700; margin:30px 0; padding:10px 20px; text-align:center; ">${html}</span></p>` :
        `<p>${html}</p>`).join('\n')
}
                    </td>
                  </tr>
                  ${ buttonLabel ?
        `
                    <tr>
                        <td height="20"></td>
                    </tr>
                    <tr>
                        <td>
                        <!-- The content action button goes here -->
                        <table class="email-action" align="center" style="border:0; height:auto; padding:0;">
                            <tr>
                            <td style="background:#0B70CE; border:0; border-radius:100px; color:#fff; text-align:center; width:100%;">
                                <!-- The button goes here -->
                                <a href="${ buttonLink}" target="_blank" style="color:#fff; display:block; font-size:14px; height:28px; letter-spacing:2px; line-height:28px; padding:8px 32px; text-decoration:none;">${buttonLabel}</a>
                            </td>
                            </tr>
                        </table>
                        </td>
                    </tr>
                    `: ''
}
                  <tr>
                    <td height="60"></td>
                  </tr>
                </table>
              </td>
              <td class="main-container-sidebar-column"></td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td height="40"></td>
      </tr>
      <tr>
        <td align="center">
          <a href="https://near.org/" target="_blank" title="NEAR Protocol">
            <img src="https://storage.googleapis.com/near-contract-helper/near-logo.png" height="40" width="133">
          </a>
        </td>
      </tr>
      <tr>
        <td height="40"></td>
      </tr>
      <tr>
        <td align="center" style="font-size: 14px;color:#A7A9AA;">
          &copy; ${(new Date()).getFullYear()} NEAR Inc. All Rights Reserved.
        </td>
      </tr>
      <tr>
        <td height="10"></td>
      </tr>
      <tr>
        <td align="center">
          <a href="https://www.iubenda.com/terms-and-conditions/44958041" title="Terms of Service" target="_blank" style="font-size: 14px;color: #A7A9AA;text-decoration: none;">Terms of Service</a>
          <span style="color: #A7A9AA;margin: 0 4px;">|</span>
          <a href="https://www.iubenda.com/privacy-policy/44958041" title="Privacy Policy" target="_blank" style="font-size: 14px;color: #A7A9AA;text-decoration: none;">Privacy Policy</a>
        </td>
      </tr>
      <tr>
        <td height="40"></td>
      </tr>
    </table>
  </body>
</html>
`;
module.exports = {
    sendMail,
    getSecurityCodeEmail,
    getNewAccountEmail,
    get2faHtml,
};

