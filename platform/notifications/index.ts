// Enhanced notification service using SendGrid integration for workflow notifications
import { MailService, type MailDataRequired } from '@sendgrid/mail';
import { sendOutlookEmail } from "./outlookEmailService";
import { logger } from "@platform/logging/Logger";

if (!process.env.SENDGRID_API_KEY) {
  logger.warn("[Email] SENDGRID_API_KEY not set — email notifications will be disabled");
}

// ============ TYPE DEFINITIONS ============

type SendGridMailData = MailDataRequired;

interface SmartObjective {
  objective?: string;
  description?: string;
}

interface Recommendations {
  primaryRecommendation?: string;
  recommendation?: string;
  summary?: string;
}

interface FinancialAnalysis {
  roi?: string | number;
  npv?: string | number;
  paybackPeriod?: string | number;
  tco?: string | number;
}

interface BusinessCaseDataForNotification {
  smartObjectives?: SmartObjective[];
  recommendations?: Recommendations;
  financialAnalysis?: FinancialAnalysis;
  executiveSummary?: string;
}

interface RequirementsData {
  capabilities?: unknown[];
  functionalRequirements?: unknown[];
  securityRequirements?: unknown[];
}

interface TeamAssignment {
  team: string;
}

interface SectionContent {
  [key: string]: unknown;
}

// ============ END TYPE DEFINITIONS ============

// HTML escaping function to prevent XSS/injection attacks
function escapeHtml(unsafe: string): string {
  return unsafe
    .replaceAll('&', "&amp;")
    .replaceAll('<', "&lt;")
    .replaceAll('>', "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  // Prefer Outlook/Office365 SMTP if configured
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return await sendOutlookEmail(params);
  }
  // Fallback to SendGrid
  if (!process.env.SENDGRID_API_KEY) {
    logger.info('[Email] Skipped (SENDGRID_API_KEY not configured):', params.subject);
    return false;
  }
  try {
    logger.info('📧 Attempting to send email:', {
      to: params.to,
      from: params.from,
      subject: params.subject
    });
    
    const emailData: SendGridMailData = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text ?? '',
      ...(params.html ? { html: params.html } : {}),
    };
    
    await mailService.send(emailData);
    
    logger.info('✅ Email sent successfully to:', params.to);
    return true;
  } catch (error: unknown) {
    const err = error as { response?: { body?: unknown }; message?: string; code?: unknown };
    logger.error('❌ SendGrid email error:', err.response?.body || err.message || error);
    logger.error('📧 Failed email details:', {
      to: params.to,
      from: params.from,
      subject: params.subject,
      errorCode: err?.code,
      errorMessage: err?.message
    });
    return false;
  }
}

// Enhanced notification templates for workflow stages
export class WorkflowNotificationService {
  private static readonly FROM_EMAIL = 'falah.aldameiry@gmail.com'; // Using verified email for SendGrid
  
  // Generate correct domain URL for Replit environment
  private static getBaseUrl(): string {
    // Check if we're in Replit environment and use the public repl.co URL format
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    }
    // Fallback to environment variable or localhost
    return process.env.REPLIT_DOMAIN || 'http://localhost:5000';
  }

  // Send meeting request notification when workflow moves to 'acknowledged'
  static async sendMeetingRequestNotification(
    recipientEmail: string,
    recipientName: string,
    demandTitle: string,
    organizationName: string,
    reportId: string
  ): Promise<boolean> {
    
    const subject = `Enterprise Intelligence - AI Transformation Platform Hub (EIAPH) - Acknowledged - Under Review`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Enterprise Intelligence - AI Transformation Platform Hub (EIAPH)</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Demand Analysis Review Process</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: #4299e1; color: white; padding: 12px 24px; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 16px;">
              Acknowledged - Under Review
            </div>
          </div>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Dear ${recipientName},
          </p>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Your demand analysis request for <strong>"${demandTitle}"</strong> from ${organizationName} has been acknowledged and is now under review by our digital transformation team.
          </p>
          
          <div style="background: #f7fafc; padding: 20px; border-left: 4px solid #4299e1; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 10px;">Next Steps:</h3>
            <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">We will contact you within 2 business days to schedule a detailed review meeting</li>
              <li style="margin-bottom: 8px;">The meeting will cover your requirements, objectives, and strategic alignment</li>
              <li style="margin-bottom: 8px;">Please prepare any additional documentation or stakeholder availability</li>
            </ul>
          </div>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 30px;">
            You can track the status of your request and access the full analysis report using the link below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Analysis Report
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Best regards,<br>
              UAE Government Digital Transformation Team<br>
              <em>Advancing UAE Vision 2071 through Digital Innovation</em>
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `
Enterprise Intelligence - AI Transformation Platform Hub (EIAPH) - Acknowledged - Under Review

Dear ${recipientName},

Your demand analysis request for "${demandTitle}" from ${organizationName} has been acknowledged and is now under review.

Next Steps:
- We will contact you within 2 business days to schedule a review meeting
- The meeting will cover your requirements and strategic alignment
- Please prepare any additional documentation

Track your request: ${this.getBaseUrl()}/demand-analysis-report/${reportId}

Best regards,
UAE Government Digital Transformation Team
    `;

    return await sendEmail({
      to: recipientEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Send status update notification when workflow changes
  static async sendWorkflowStatusNotification(
    recipientEmail: string,
    recipientName: string,
    demandTitle: string,
    organizationName: string,
    newStatus: string,
    statusReason: string,
    reportId: string
  ): Promise<boolean> {
    const statusDisplayNames = {
      'acknowledged': 'Acknowledged - Under Review',
      'meeting_scheduled': 'Meeting Scheduled',
      'under_review': 'Under Detailed Review',
      'initially_approved': 'Initially Approved - Pending Final Review',
      'manager_approved': 'Approved',
      'deferred': 'Deferred for Future Review',
      'rejected': 'Request Not Approved'
    };

    const statusColors = {
      'acknowledged': '#4299e1',
      'meeting_scheduled': '#9f7aea',
      'under_review': '#ed8936',
      'initially_approved': '#38a169',
      'manager_approved': '#059669',
      'deferred': '#d69e2e',
      'rejected': '#e53e3e'
    };

    const statusDisplay = statusDisplayNames[newStatus as keyof typeof statusDisplayNames] || newStatus;
    const statusColor = statusColors[newStatus as keyof typeof statusColors] || '#4a5568';

    const subject = `Enterprise Intelligence - AI Transformation Platform Hub (EIAPH) - Status Update: ${statusDisplay}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Enterprise Intelligence - AI Transformation Platform Hub (EIAPH)</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Demand Analysis Status Update</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: ${statusColor}; color: white; padding: 12px 24px; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 16px;">
              ${statusDisplay}
            </div>
          </div>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Dear ${recipientName},
          </p>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            The status of your demand analysis request for <strong>"${demandTitle}"</strong> from ${organizationName} has been updated.
          </p>
          
          ${statusReason ? `
          <div style="background: #f7fafc; padding: 20px; border-left: 4px solid ${statusColor}; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 10px;">Status Details:</h3>
            <p style="color: #4a5568; margin: 0;">${statusReason}</p>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Analysis Report
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Best regards,<br>
              UAE Government Digital Transformation Team<br>
              <em>Advancing UAE Vision 2071 through Digital Innovation</em>
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `
Enterprise Intelligence - AI Transformation Platform Hub (EIAPH) - Status Update

Dear ${recipientName},

Status Update: ${statusDisplay}
Request: "${demandTitle}" from ${organizationName}

${statusReason ? `Details: ${statusReason}` : ''}

Track your request: ${this.getBaseUrl()}/demand-analysis-report/${reportId}

Best regards,
UAE Government Digital Transformation Team
    `;

    return await sendEmail({
      to: recipientEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Send manager approval request notification
  static async sendManagerApprovalNotification(
    managerEmail: string,
    demandTitle: string,
    organizationName: string,
    requestorName: string,
    reportId: string
  ): Promise<boolean> {
    const subject = `Enterprise Intelligence - AI Transformation Platform Hub (EIAPH) - Manager Approval Required`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Enterprise Intelligence - AI Transformation Platform Hub (EIAPH)</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Manager Approval Required</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1a202c; margin-bottom: 20px;">Final Approval Required</h2>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            A demand analysis request has received initial approval and requires your final management approval:
          </p>
          
          <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">Request Details:</h3>
            <p style="margin: 5px 0;"><strong>Title:</strong> ${demandTitle}</p>
            <p style="margin: 5px 0;"><strong>Organization:</strong> ${organizationName}</p>
            <p style="margin: 5px 0;"><strong>Requestor:</strong> ${requestorName}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Initially Approved</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Review & Approve Request
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Best regards,<br>
              UAE Government Digital Transformation Team
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `
Enterprise Intelligence - AI Transformation Platform Hub (EIAPH) - Manager Approval Required

A demand analysis request has received initial approval and requires your final management approval:

Title: ${demandTitle}
Organization: ${organizationName}
Requestor: ${requestorName}
Status: Initially Approved

Review the request: ${this.getBaseUrl()}/demand-analysis-report/${reportId}

Best regards,
UAE Government Digital Transformation Team
    `;

    return await sendEmail({
      to: managerEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Send section assignment notification when a section is assigned to a team member
  static async sendSectionAssignmentNotification(
    assigneeEmail: string,
    assigneeName: string,
    sectionTitle: string,
    sectionId: string,
    demandTitle: string,
    organizationName: string,
    params: { assignedByName: string; assignedByRole: string; priority: 'low' | 'medium' | 'high' | 'urgent'; dueDate: Date | null; reviewComments: string; reportId: string },
  ): Promise<boolean> {
    const { assignedByName, assignedByRole, priority, dueDate, reviewComments, reportId } = params;
    
    // Debug logging to see what URL is being generated
    const reviewUrl = `${this.getBaseUrl()}/demand-analysis-report/${reportId}?section=${sectionId}`;
    logger.info('🔗 Generated review URL:', {
      reportId,
      sectionId,
      sectionTitle,
      reviewUrl,
      baseUrl: this.getBaseUrl()
    });
    
    const priorityColors = {
      'low': '#38a169',
      'medium': '#ed8936', 
      'high': '#e53e3e',
      'urgent': '#9f1239'
    };
    
    const priorityColor = priorityColors[priority] || '#4a5568';
    const dueDateText = dueDate ? new Date(dueDate).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Dubai'
    }) : 'No specific deadline';

    const subject = `EIAPH - Business Case Section Assignment: ${sectionTitle}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Enterprise Intelligence - AI Transformation Platform Hub (EIAPH)</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Business Case Section Assignment</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1a202c; margin-bottom: 20px;">Section Review Assignment</h2>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Dear ${assigneeName},
          </p>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            You have been assigned to review a business case section for <strong>"${demandTitle}"</strong> from ${organizationName}.
          </p>
          
          <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">Assignment Details:</h3>
            <p style="margin: 8px 0;"><strong>Section:</strong> ${sectionTitle}</p>
            <p style="margin: 8px 0;"><strong>Priority:</strong> <span style="color: ${priorityColor}; font-weight: bold; text-transform: uppercase;">${priority}</span></p>
            <p style="margin: 8px 0;"><strong>Due Date:</strong> ${dueDateText}</p>
            <p style="margin: 8px 0;"><strong>Assigned By:</strong> ${assignedByName} (${assignedByRole})</p>
            ${reviewComments ? `<p style="margin: 8px 0;"><strong>Review Instructions:</strong> ${reviewComments}</p>` : ''}
          </div>
          
          <div style="background: #fff5f5; padding: 15px; border-left: 4px solid ${priorityColor}; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 10px;">Your Responsibilities:</h3>
            <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Review the assigned section content for accuracy and completeness</li>
              <li style="margin-bottom: 8px;">Provide feedback and suggestions for improvement</li>
              <li style="margin-bottom: 8px;">Update section status upon completion of review</li>
              <li style="margin-bottom: 8px;">Ensure alignment with UAE Vision 2071 objectives</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}?section=${sectionId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 15px;">
              Review Section
            </a>
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}" 
               style="background: #4a5568; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Full Report
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Best regards,<br>
              UAE Government Digital Transformation Team<br>
              <em>Advancing UAE Vision 2071 through Digital Innovation</em>
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `
Enterprise Intelligence - AI Transformation Platform Hub (EIAPH) - Section Assignment

Dear ${assigneeName},

You have been assigned to review a business case section:

Report: "${demandTitle}" from ${organizationName}
Section: ${sectionTitle}
Priority: ${priority.toUpperCase()}
Due Date: ${dueDateText}
Assigned By: ${assignedByName} (${assignedByRole})

${reviewComments ? `Instructions: ${reviewComments}` : ''}

Review the section: ${this.getBaseUrl()}/demand-analysis-report/${reportId}?section=${sectionId}

Your responsibilities:
- Review section content for accuracy and completeness
- Provide feedback and suggestions for improvement
- Update section status upon completion of review
- Ensure alignment with UAE Vision 2071 objectives

Best regards,
UAE Government Digital Transformation Team
    `;

    return await sendEmail({
      to: assigneeEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Send business case to manager for final approval
  static async sendBusinessCaseToManager(
    managerEmail: string,
    businessCaseData: BusinessCaseDataForNotification,
    versionNumber: string,
    senderName: string,
    message: string,
    reportId: string,
    params: { versionId: string; reportTitle?: string }
  ): Promise<boolean> {
    const { reportTitle = 'Not recorded' } = params;
    // Get business case title - use report title as primary source
    const businessCaseTitle = reportTitle;
    
    // Get primary objective (first SMART objective from the smartObjectives JSON field)
    let primaryObjective = '';
    if (businessCaseData.smartObjectives && Array.isArray(businessCaseData.smartObjectives)) {
      const firstObjective = businessCaseData.smartObjectives[0];
      primaryObjective = firstObjective?.objective || firstObjective?.description || '';
    }
    
    // Get primary recommendation from the recommendations JSON field
    let primaryRecommendation = '';
    if (businessCaseData.recommendations) {
      const recs = businessCaseData.recommendations;
      primaryRecommendation = recs?.primaryRecommendation?.toString() || recs?.recommendation?.toString() || recs?.summary || '';
    }
    
    logger.info('📧 Email data:', { businessCaseTitle, primaryObjective, primaryRecommendation });
    
    // Create concise, professional subject line
    const subject = `Manager Approval Required - Business Case v${versionNumber}`;
    
    const formatSection = (title: string, content: SectionContent | string) => {
      if (!content) return '';
      if (typeof content === 'string') return `<p style="color: #4a5568; line-height: 1.6;">${content}</p>`;
      return `<pre style="background: #f7fafc; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(content, null, 2)}</pre>`;
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Enterprise Intelligence - AI Transformation Platform Hub</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Business Case - Final Manager Approval Required</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1a202c; margin-bottom: 20px;">Business Case Ready for Final Approval</h2>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            A comprehensive business case has been prepared and requires your final approval for publication.
          </p>

          <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">Business Case Details:</h3>
            <p style="margin: 8px 0;"><strong>Title:</strong> ${businessCaseTitle}</p>
            <p style="margin: 8px 0;"><strong>Version:</strong> ${versionNumber}</p>
            <p style="margin: 8px 0;"><strong>Sent By:</strong> ${senderName}</p>
            ${message ? `<p style="margin: 8px 0;"><strong>Message:</strong> ${message}</p>` : ''}
          </div>

          ${businessCaseData.executiveSummary ? `
          <div style="background: #fff; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 10px;">Executive Summary</h3>
            ${formatSection('', businessCaseData.executiveSummary)}
          </div>
          ` : ''}

          ${primaryObjective ? `
          <div style="background: #fff; padding: 20px; border-left: 4px solid #4299e1; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 10px;">Primary Objective</h3>
            <p style="color: #4a5568; line-height: 1.6;">${primaryObjective}</p>
          </div>
          ` : ''}

          ${businessCaseData.financialAnalysis ? `
          <div style="background: #fff; padding: 20px; border-left: 4px solid #38a169; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 10px;">Financial Analysis</h3>
            <p style="margin: 5px 0;"><strong>ROI:</strong> ${businessCaseData.financialAnalysis?.roi || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>NPV:</strong> ${businessCaseData.financialAnalysis?.npv || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Payback Period:</strong> ${businessCaseData.financialAnalysis?.paybackPeriod || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>TCO:</strong> ${businessCaseData.financialAnalysis?.tco || 'N/A'}</p>
          </div>
          ` : ''}

          ${primaryRecommendation ? `
          <div style="background: #fff; padding: 20px; border-left: 4px solid #ed8936; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 10px;">Primary Recommendation</h3>
            <p style="color: #4a5568; line-height: 1.6;">${primaryRecommendation}</p>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
              Review Full Business Case & Approve
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Best regards,<br>
              UAE Government Digital Transformation Team<br>
              <em>Advancing UAE Vision 2071 through Digital Innovation</em>
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `
Enterprise Intelligence - AI Transformation Platform Hub
Business Case - Final Manager Approval Required

A comprehensive business case has been prepared and requires your final approval for publication.

Title: ${businessCaseTitle}
Version: ${versionNumber}
Sent By: ${senderName}
${message ? `Message: ${message}` : ''}

${businessCaseData.executiveSummary ? `
Executive Summary:
${businessCaseData.executiveSummary}
` : ''}

${primaryObjective ? `
Primary Objective:
${primaryObjective}
` : ''}

${businessCaseData.financialAnalysis ? `
Financial Analysis:
ROI: ${businessCaseData.financialAnalysis?.roi || 'N/A'}
NPV: ${businessCaseData.financialAnalysis?.npv || 'N/A'}
Payback Period: ${businessCaseData.financialAnalysis?.paybackPeriod || 'N/A'}
TCO: ${businessCaseData.financialAnalysis?.tco || 'N/A'}
` : ''}

${primaryRecommendation ? `
Primary Recommendation:
${primaryRecommendation}
` : ''}

Review the full business case: ${this.getBaseUrl()}/demand-analysis-report/${reportId}

Best regards,
UAE Government Digital Transformation Team
    `;

    return await sendEmail({
      to: managerEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Send requirements analysis to manager for final approval
  static async sendRequirementsToManager(
    managerEmail: string,
    requirementsData: RequirementsData,
    teamAssignments: TeamAssignment[],
    versionNumber: string,
    senderName: string,
    message: string,
    params: { reportId: string; versionId: string; reportTitle?: string }
  ): Promise<boolean> {
    const { reportId, reportTitle = 'Digital Transformation Requirements' } = params;
    const requirementsTitle = reportTitle;
    
    // Get key requirements summary
    const capabilitiesCount = requirementsData.capabilities?.length || 0;
    const functionalCount = requirementsData.functionalRequirements?.length || 0;
    const securityCount = requirementsData.securityRequirements?.length || 0;
    
    // Get team assignment summary
    const teamSummary: Record<string, number> = teamAssignments?.reduce((acc: Record<string, number>, assignment: TeamAssignment) => {
      acc[assignment.team] = (acc[assignment.team] || 0) + 1;
      return acc;
    }, {}) || {};
    
    const subject = `Manager Approval Required - Requirements Analysis v${versionNumber}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Enterprise Intelligence - Requirements Analysis</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Requirements - Final Manager Approval Required</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1a202c; margin-bottom: 20px;">Requirements Analysis Ready for Final Approval</h2>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            A comprehensive requirements analysis has been prepared by ${senderName} and requires your final approval.
          </p>
          
          <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">Requirements Summary:</h3>
            <p style="margin: 5px 0;"><strong>Report:</strong> ${requirementsTitle}</p>
            <p style="margin: 5px 0;"><strong>Version:</strong> ${versionNumber}</p>
            <p style="margin: 5px 0;"><strong>Capabilities Identified:</strong> ${capabilitiesCount}</p>
            <p style="margin: 5px 0;"><strong>Functional Requirements:</strong> ${functionalCount}</p>
            <p style="margin: 5px 0;"><strong>Security Requirements:</strong> ${securityCount}</p>
          </div>
          
          ${Object.keys(teamSummary).length > 0 ? `
          <div style="background: #f0fdf4; padding: 15px; border: 1px solid #86efac; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #166534; margin-bottom: 10px;">Team Assignments:</h4>
            ${Object.entries(teamSummary).map(([team, count]) => 
              `<p style="margin: 3px 0; color: #15803d;">• ${team}: ${count} section(s)</p>`
            ).join('')}
          </div>
          ` : ''}
          
          ${message ? `
          <div style="background: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0;">
            <p style="color: #1e40af; margin: 0;"><strong>Message from ${senderName}:</strong></p>
            <p style="color: #1e40af; margin: 10px 0 0 0;">${message}</p>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}?tab=requirements" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Review & Approve Requirements
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Best regards,<br>
              UAE Government Digital Transformation Team<br>
              <em>Advancing UAE Vision 2071 through Digital Innovation</em>
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `Requirements Analysis - Manager Approval Required
    
Report: ${requirementsTitle}
Version: ${versionNumber}
Sent by: ${senderName}

${message ? `Message: ${message}` : ''}

Review and approve: ${this.getBaseUrl()}/demand-analysis-report/${reportId}?tab=requirements

Best regards,
UAE Government Digital Transformation Team`;
    
    return await sendEmail({
      to: managerEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Send section status change notification
  static async sendSectionStatusNotification(
    assigneeEmail: string,
    assigneeName: string,
    sectionTitle: string,
    demandTitle: string,
    oldStatus: string,
    newStatus: string,
    params: { statusComments: string; changedByName: string; reportId: string; sectionId: string }
  ): Promise<boolean> {
    const { statusComments, changedByName, reportId, sectionId } = params;
    
    const statusDisplayNames = {
      'pending': 'Pending Review',
      'assigned': 'Assigned',
      'in_review': 'Under Review',
      'review_complete': 'Review Complete',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'revision_required': 'Revision Required'
    };
    
    const statusColors = {
      'pending': '#718096',
      'assigned': '#4299e1',
      'in_review': '#ed8936',
      'review_complete': '#38a169',
      'approved': '#059669',
      'rejected': '#e53e3e',
      'revision_required': '#d69e2e'
    };

    const statusDisplay = statusDisplayNames[newStatus as keyof typeof statusDisplayNames] || newStatus;
    const statusColor = statusColors[newStatus as keyof typeof statusColors] || '#4a5568';

    const subject = `EIAPH - Section Status Update: ${sectionTitle} - ${statusDisplay}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Enterprise Intelligence - AI Transformation Platform Hub (EIAPH)</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Section Status Update</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: ${statusColor}; color: white; padding: 12px 24px; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 16px;">
              ${statusDisplay}
            </div>
          </div>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Dear ${assigneeName},
          </p>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            The status of section <strong>"${sectionTitle}"</strong> in business case <strong>"${demandTitle}"</strong> has been updated.
          </p>
          
          <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">Status Change Details:</h3>
            <p style="margin: 8px 0;"><strong>Previous Status:</strong> ${statusDisplayNames[oldStatus as keyof typeof statusDisplayNames] || oldStatus}</p>
            <p style="margin: 8px 0;"><strong>New Status:</strong> ${statusDisplay}</p>
            <p style="margin: 8px 0;"><strong>Changed By:</strong> ${changedByName}</p>
            ${statusComments ? `<p style="margin: 8px 0;"><strong>Comments:</strong> ${statusComments}</p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}?section=${sectionId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Section
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Best regards,<br>
              UAE Government Digital Transformation Team<br>
              <em>Advancing UAE Vision 2071 through Digital Innovation</em>
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `
Enterprise Intelligence - AI Transformation Platform Hub (EIAPH) - Section Status Update

Dear ${assigneeName},

Section Status Update: ${statusDisplay}

Section: "${sectionTitle}" in "${demandTitle}"
Previous Status: ${statusDisplayNames[oldStatus as keyof typeof statusDisplayNames] || oldStatus}
New Status: ${statusDisplay}
Changed By: ${changedByName}

${statusComments ? `Comments: ${statusComments}` : ''}

View section: ${this.getBaseUrl()}/demand-analysis-report/${reportId}?section=${sectionId}

Best regards,
UAE Government Digital Transformation Team
    `;

    return await sendEmail({
      to: assigneeEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Send team assignment notification for requirements sections
  static async sendTeamAssignmentEmail(params: {
    reportId: string;
    reportTitle: string;
    sectionId: string;
    sectionTitle: string;
    teamName: string;
    assignedBy: string;
    message?: string;
  }): Promise<boolean> {
    const { reportId, reportTitle, sectionId, sectionTitle, teamName, assignedBy, message } = params;
    
    // In a real implementation, this would look up team email addresses
    // For now, using a demo email (replace with actual team lookup)
    const teamEmail = 'falah.aldameiry@gmail.com';
    
    const subject = `Team Assignment - ${sectionTitle} Section`;
    
    const defaultMessage = `You have been assigned to work on the "${sectionTitle}" section of the detailed requirements analysis. Please review the current content and update as needed.`;
    const notificationMessage = message || defaultMessage;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Team Assignment Notification</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Detailed Requirements Analysis</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1a202c; margin-bottom: 20px;">New Section Assignment</h2>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Dear ${teamName},
          </p>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            ${notificationMessage}
          </p>
          
          <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">Assignment Details:</h3>
            <p style="margin: 5px 0; color: #4a5568;"><strong>Project:</strong> ${reportTitle}</p>
            <p style="margin: 5px 0; color: #4a5568;"><strong>Section:</strong> ${sectionTitle}</p>
            <p style="margin: 5px 0; color: #4a5568;"><strong>Assigned By:</strong> ${assignedBy}</p>
            <p style="margin: 5px 0; color: #4a5568;"><strong>Assigned Team:</strong> ${teamName}</p>
          </div>
          
          <div style="background: #ecfdf5; padding: 15px; border: 1px solid #86efac; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #065f46; margin-bottom: 10px;">Your Responsibilities:</h4>
            <ul style="color: #047857; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Review the current content of your assigned section</li>
              <li style="margin-bottom: 8px;">Update and enhance the requirements based on your expertise</li>
              <li style="margin-bottom: 8px;">Ensure all information is accurate and complete</li>
              <li style="margin-bottom: 8px;">Collaborate with other teams as needed</li>
            </ul>
          </div>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 30px;">
            Click the button below to access your assigned section and begin working:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}?tab=requirements&section=${sectionId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Access Section
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Best regards,<br>
              UAE Government Digital Transformation Team<br>
              <em>Advancing UAE Vision 2071 through Digital Innovation</em>
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `
Team Assignment Notification - ${sectionTitle}

Dear ${teamName},

${notificationMessage}

Assignment Details:
- Project: ${reportTitle}
- Section: ${sectionTitle}
- Assigned By: ${assignedBy}
- Assigned Team: ${teamName}

Your Responsibilities:
- Review the current content of your assigned section
- Update and enhance the requirements based on your expertise
- Ensure all information is accurate and complete
- Collaborate with other teams as needed

Access your section: ${this.getBaseUrl()}/demand-analysis-report/${reportId}?tab=requirements&section=${sectionId}

Best regards,
UAE Government Digital Transformation Team
    `;

    return await sendEmail({
      to: teamEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Send Business Case meeting notification
  static async sendBusinessCaseMeetingNotification(params: {
    recipientEmail: string;
    recipientName: string;
    demandTitle: string;
    organizationName: string;
    reportId: string;
    meetingDate: Date;
    meetingNotes?: string;
  }): Promise<boolean> {
    const { recipientEmail, recipientName, demandTitle, organizationName, reportId, meetingDate, meetingNotes } = params;
    
    const formattedDate = new Date(meetingDate).toLocaleString('en-AE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dubai'
    });
    
    const subject = `Business Case Review Meeting Scheduled - ${demandTitle}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Business Case Review Meeting</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Meeting Scheduled</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: #10b981; color: white; padding: 12px 24px; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 16px;">
              📅 Meeting Scheduled
            </div>
          </div>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Dear ${recipientName},
          </p>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            A Business Case review meeting has been scheduled for <strong>"${demandTitle}"</strong> from ${organizationName}.
          </p>
          
          <div style="background: #f7fafc; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">📅 Meeting Details:</h3>
            <p style="margin: 8px 0; color: #4a5568; font-size: 16px;"><strong>Date & Time:</strong></p>
            <p style="margin: 8px 0 15px 0; color: #1a202c; font-size: 18px; font-weight: bold;">${formattedDate} (Dubai Time, GMT+4)</p>
            <p style="margin: 8px 0; color: #4a5568;"><strong>Project:</strong> ${demandTitle}</p>
            <p style="margin: 8px 0; color: #4a5568;"><strong>Organization:</strong> ${organizationName}</p>
            ${meetingNotes ? `<div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 6px;">
              <p style="margin: 0; color: #92400e;"><strong>Meeting Notes:</strong></p>
              <p style="margin: 8px 0 0 0; color: #78350f;">${meetingNotes}</p>
            </div>` : ''}
          </div>
          
          <div style="background: #ecfdf5; padding: 15px; border: 1px solid #86efac; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #065f46; margin-bottom: 10px;">Meeting Agenda:</h4>
            <ul style="color: #047857; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Review Business Case analysis and financial projections</li>
              <li style="margin-bottom: 8px;">Discuss strategic alignment with organizational goals</li>
              <li style="margin-bottom: 8px;">Address questions and clarifications</li>
              <li style="margin-bottom: 8px;">Determine next steps for approval process</li>
            </ul>
          </div>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 30px;">
            You can review the full Business Case analysis using the link below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}?tab=business-case" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Business Case
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Best regards,<br>
              UAE Government Digital Transformation Team<br>
              <em>Advancing UAE Vision 2071 through Digital Innovation</em>
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `
Business Case Review Meeting Scheduled

Dear ${recipientName},

A Business Case review meeting has been scheduled for "${demandTitle}" from ${organizationName}.

Meeting Details:
Date & Time: ${formattedDate} (Dubai Time, GMT+4)
Project: ${demandTitle}
Organization: ${organizationName}
${meetingNotes ? `\nMeeting Notes: ${meetingNotes}` : ''}

Meeting Agenda:
- Review Business Case analysis and financial projections
- Discuss strategic alignment with organizational goals
- Address questions and clarifications
- Determine next steps for approval process

View Business Case: ${this.getBaseUrl()}/demand-analysis-report/${reportId}?tab=business-case

Best regards,
UAE Government Digital Transformation Team
Advancing UAE Vision 2071 through Digital Innovation
    `;
    
    return await sendEmail({
      to: recipientEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Send notification to team members when assigned to a requirements section
  static async sendTeamAssignmentNotification(
    teamMembers: Array<{ email: string; displayName: string }>,
    teamName: string,
    sectionName: string,
    demandTitle: string,
    reportId: string,
    assignedBy: string,
    notes?: string
  ): Promise<{sent: number; failed: number}> {
    
    // Escape all user-supplied input to prevent XSS/injection attacks
    const safeMemberName = (name: string) => escapeHtml(name);
    const safeTeamName = escapeHtml(teamName);
    const safeDemandTitle = escapeHtml(demandTitle);
    const safeAssignedBy = escapeHtml(assignedBy);
    const safeNotes = notes ? escapeHtml(notes) : undefined;
    
    const sectionDisplayName = sectionName
      .replaceAll(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    const safeSectionDisplayName = escapeHtml(sectionDisplayName);
    
    let sent = 0;
    let failed = 0;
    
    for (const member of teamMembers) {
      const subject = `Section Assignment: ${sectionDisplayName} - ${demandTitle}`;
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Enterprise Intelligence - AI Transformation Platform Hub (EIAPH)</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0 0;">Requirements Section Assignment</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background: #10b981; color: white; padding: 12px 24px; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 16px;">
                New Section Assignment
              </div>
            </div>
            
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
              Dear ${safeMemberName(member.displayName)},
            </p>
            
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
              Your team <strong>"${safeTeamName}"</strong> has been assigned to work on the <strong>${safeSectionDisplayName}</strong> section for the project <strong>"${safeDemandTitle}"</strong>.
            </p>
            
            <div style="background: #f7fafc; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0;">
              <h3 style="color: #2d3748; margin-bottom: 10px;">Assignment Details:</h3>
              <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;"><strong>Project:</strong> ${safeDemandTitle}</li>
                <li style="margin-bottom: 8px;"><strong>Section:</strong> ${safeSectionDisplayName}</li>
                <li style="margin-bottom: 8px;"><strong>Team:</strong> ${safeTeamName}</li>
                <li style="margin-bottom: 8px;"><strong>Assigned By:</strong> ${safeAssignedBy}</li>
                ${safeNotes ? `<li style="margin-bottom: 8px;"><strong>Notes:</strong> ${safeNotes}</li>` : ''}
              </ul>
            </div>
            
            <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>Action Required:</strong> Please review and complete your assigned section. You can now edit this section in the requirements tab.
              </p>
            </div>
            
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 30px;">
              Click the button below to access the detailed requirements and start working on your assigned section:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}?tab=requirements" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                View Assigned Section
              </a>
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
              <p style="color: #718096; font-size: 14px; margin: 0;">
                Best regards,<br>
                UAE Government Digital Transformation Team<br>
                <em>Advancing UAE Vision 2071 through Digital Innovation</em>
              </p>
            </div>
          </div>
        </div>
      `;
      
      const text = `
Section Assignment Notification

Dear ${member.displayName},

Your team "${teamName}" has been assigned to work on the ${sectionDisplayName} section for the project "${demandTitle}".

Assignment Details:
- Project: ${demandTitle}
- Section: ${sectionDisplayName}
- Team: ${teamName}
- Assigned By: ${assignedBy}
${notes ? `- Notes: ${notes}` : ''}

Action Required: Please review and complete your assigned section.

View Assigned Section: ${this.getBaseUrl()}/demand-analysis-report/${reportId}?tab=requirements

Best regards,
UAE Government Digital Transformation Team
Advancing UAE Vision 2071 through Digital Innovation
      `;
      
      const success = await sendEmail({
        to: member.email,
        from: this.FROM_EMAIL,
        subject,
        html,
        text
      });
      
      if (success) {
        sent++;
        logger.info(`✅ Team assignment notification sent to ${member.email}`);
      } else {
        failed++;
        logger.info(`❌ Failed to send team assignment notification to ${member.email}`);
      }
    }
    
    return { sent, failed };
  }

  // Coveria AI - Send specialist notification when demand requires expert attention
  static async sendCoveriaSpecialistNotification(
    specialistEmail: string,
    specialistName: string,
    specialistRole: string,
    demandTitle: string,
    organizationName: string,
    params: { urgency: string; coveriaInsight: string; reportId: string }
  ): Promise<boolean> {
    const { urgency, coveriaInsight, reportId } = params;
    
    const urgencyColors: Record<string, string> = {
      'high': '#e53e3e',
      'critical': '#9f1239',
      'medium': '#ed8936',
      'low': '#38a169'
    };
    
    const urgencyColor = urgencyColors[urgency.toLowerCase()] || '#4a5568';
    
    const subject = `COREVIA AI Alert - ${specialistRole} Review Required: ${demandTitle}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #d946ef 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <div style="background: white; width: 50px; height: 50px; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 24px; font-weight: bold; color: #8b5cf6;">C</span>
          </div>
          <h1 style="color: white; margin: 0; font-size: 24px;">COREVIA - Strategic Intelligence Advisor</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0;">Specialist Attention Required</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #8b5cf6;">
            <p style="color: #6d28d9; margin: 0; font-style: italic;">
              "Brilliant! I've identified a demand request that requires your expertise. Shall we have a look?"
            </p>
          </div>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Dear ${specialistName},
          </p>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Based on my analysis, the following demand request requires review by a <strong>${specialistRole}</strong>:
          </p>
          
          <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">Demand Details:</h3>
            <p style="margin: 8px 0;"><strong>Title:</strong> ${demandTitle}</p>
            <p style="margin: 8px 0;"><strong>Organization:</strong> ${organizationName}</p>
            <p style="margin: 8px 0;"><strong>Urgency:</strong> <span style="color: ${urgencyColor}; font-weight: bold; text-transform: uppercase;">${urgency}</span></p>
            <p style="margin: 8px 0;"><strong>Your Role:</strong> ${specialistRole}</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); padding: 20px; border-left: 4px solid #a855f7; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <h3 style="color: #7c3aed; margin-bottom: 10px;">COREVIA's Insight:</h3>
            <p style="color: #6b21a8; margin: 0;">${coveriaInsight}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.getBaseUrl()}/demand-analysis-report/${reportId}" 
               style="background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Review Demand Request
            </a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              Splendid regards,<br>
              <strong style="color: #8b5cf6;">COREVIA</strong> - Your Strategic Intelligence Advisor<br>
              <em>UAE Government Digital Transformation Team</em>
            </p>
          </div>
        </div>
      </div>
    `;
    
    const text = `
COREVIA AI Alert - Specialist Review Required

Dear ${specialistName},

Based on my analysis, a demand request requires your expertise as ${specialistRole}:

Title: ${demandTitle}
Organization: ${organizationName}
Urgency: ${urgency.toUpperCase()}

Coveria's Insight: ${coveriaInsight}

Review the request: ${this.getBaseUrl()}/demand-analysis-report/${reportId}

Splendid regards,
COREVIA - Your Strategic Intelligence Advisor
UAE Government Digital Transformation Team
    `;

    return await sendEmail({
      to: specialistEmail,
      from: this.FROM_EMAIL,
      subject,
      html,
      text
    });
  }

  // Helper method to log notification history
  static createNotificationLogEntry(
    type: 'meeting_request' | 'status_update' | 'manager_approval' | 'section_assignment' | 'section_status' | 'business_case_meeting' | 'coveria_specialist',
    recipient: string,
    success: boolean
  ) {
    return {
      type,
      recipient,
      timestamp: new Date().toISOString(),
      success,
      sentAt: new Date().toISOString()
    };
  }
}

// Superadmin user ID for receiving all COREVIA notifications (for testing)
export const SUPERADMIN_USER_ID = '7e110fba-faa5-4d03-9ca1-57a79df7247b';

// Helper to check if superadmin notification mirroring is enabled
export function isSuperadminMirroringEnabled(): boolean {
  return true; // Set to false to disable superadmin notification mirroring
}

// Get the superadmin user ID if mirroring is enabled
export function getSuperadminUserId(): string | null {
  return isSuperadminMirroringEnabled() ? SUPERADMIN_USER_ID : null;
}