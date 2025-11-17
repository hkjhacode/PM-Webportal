/**
 * Comprehensive Audit Logging System
 * Tracks all user actions, system events, and data changes
 */

import { User } from '@/models/user';
import { PMVisit } from '@/models/pm-visit';
import { EnhancedWorkflowRequest } from '@/models/enhanced-workflow-request';
import { DynamicFormTemplate } from '@/models/dynamic-form-template';

export interface AuditLogEntry {
  action: string;
  userId: string;
  userRole: string;
  timestamp: Date;
  resourceType: 'user' | 'pm_visit' | 'workflow' | 'form_template' | 'system';
  resourceId?: string;
  details: {
    before?: any;
    after?: any;
    changes?: Record<string, { before: any; after: any }>;
    metadata?: Record<string, any>;
  };
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;
}

export class AuditLogger {
  private static instance: AuditLogger;
  
  private constructor() {}
  
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log user authentication events
   */
  async logAuthentication(
    action: 'login' | 'logout' | 'login_failed' | 'session_expired',
    userId: string,
    userRole: string,
    details: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      failureReason?: string;
      attempts?: number;
    } = {}
  ): Promise<void> {
    await this.log({
      action: `auth_${action}`,
      userId,
      userRole,
      timestamp: new Date(),
      resourceType: 'system',
      details: {
        metadata: {
          ipAddress: details.ipAddress,
          userAgent: details.userAgent,
          sessionId: details.sessionId,
          failureReason: details.failureReason,
          attempts: details.attempts
        }
      },
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      sessionId: details.sessionId,
      severity: action === 'login_failed' ? 'warning' : 'info',
      result: action === 'login_failed' || action === 'session_expired' ? 'failure' : 'success',
      errorMessage: details.failureReason
    });
  }

  /**
   * Log PM Visit actions
   */
  async logPMVisitAction(
    action: 'created' | 'updated' | 'deleted' | 'activated' | 'completed' | 'cancelled',
    userId: string,
    userRole: string,
    pmVisitId: string,
    details: {
      before?: any;
      after?: any;
      changes?: Record<string, { before: any; after: any }>;
      metadata?: Record<string, any>;
    } = {},
    requestInfo?: { ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<void> {
    await this.log({
      action: `pm_visit_${action}`,
      userId,
      userRole,
      timestamp: new Date(),
      resourceType: 'pm_visit',
      resourceId: pmVisitId,
      details,
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
      sessionId: requestInfo?.sessionId,
      severity: this.getActionSeverity(action),
      result: 'success'
    });
  }

  /**
   * Log Workflow actions
   */
  async logWorkflowAction(
    action: 'created' | 'updated' | 'approved' | 'rejected' | 'rollback' | 'forwarded' | 'submitted',
    userId: string,
    userRole: string,
    workflowId: string,
    details: {
      fromStage?: string;
      toStage?: string;
      notes?: string;
      version?: number;
      data?: any;
      metadata?: Record<string, any>;
    } = {},
    requestInfo?: { ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<void> {
    await this.log({
      action: `workflow_${action}`,
      userId,
      userRole,
      timestamp: new Date(),
      resourceType: 'workflow',
      resourceId: workflowId,
      details: {
        after: {
          fromStage: details.fromStage,
          toStage: details.toStage,
          notes: details.notes,
          version: details.version,
          data: details.data
        },
        metadata: details.metadata
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
      sessionId: requestInfo?.sessionId,
      severity: action === 'rollback' ? 'warning' : 'info',
      result: 'success'
    });
  }

  /**
   * Log User Management actions
   */
  async logUserAction(
    action: 'created' | 'updated' | 'deleted' | 'role_assigned' | 'role_removed' | 'password_reset' | 'credentials_generated',
    userId: string,
    userRole: string,
    targetUserId: string,
    details: {
      before?: any;
      after?: any;
      changes?: Record<string, { before: any; after: any }>;
      roles?: string[];
      metadata?: Record<string, any>;
    } = {},
    requestInfo?: { ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<void> {
    await this.log({
      action: `user_${action}`,
      userId,
      userRole,
      timestamp: new Date(),
      resourceType: 'user',
      resourceId: targetUserId,
      details,
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
      sessionId: requestInfo?.sessionId,
      severity: ['deleted', 'password_reset', 'credentials_generated'].includes(action) ? 'warning' : 'info',
      result: 'success'
    });
  }

  /**
   * Log Form Template actions
   */
  async logFormTemplateAction(
    action: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated',
    userId: string,
    userRole: string,
    templateId: string,
    details: {
      before?: any;
      after?: any;
      changes?: Record<string, { before: any; after: any }>;
      state?: string;
      vertical?: string;
      version?: string;
      metadata?: Record<string, any>;
    } = {},
    requestInfo?: { ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<void> {
    await this.log({
      action: `form_template_${action}`,
      userId,
      userRole,
      timestamp: new Date(),
      resourceType: 'form_template',
      resourceId: templateId,
      details,
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
      sessionId: requestInfo?.sessionId,
      severity: ['deleted', 'deactivated'].includes(action) ? 'warning' : 'info',
      result: 'success'
    });
  }

  /**
   * Log Data Access events
   */
  async logDataAccess(
    action: 'viewed' | 'exported' | 'downloaded' | 'searched',
    userId: string,
    userRole: string,
    resourceType: 'user' | 'pm_visit' | 'workflow' | 'form_template' | 'report',
    resourceId?: string,
    details: {
      filters?: Record<string, any>;
      resultCount?: number;
      metadata?: Record<string, any>;
    } = {},
    requestInfo?: { ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<void> {
    await this.log({
      action: `data_${action}`,
      userId,
      userRole,
      timestamp: new Date(),
      resourceType,
      resourceId,
      details: {
        metadata: {
          filters: details.filters,
          resultCount: details.resultCount,
          ...details.metadata
        }
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
      sessionId: requestInfo?.sessionId,
      severity: 'info',
      result: 'success'
    });
  }

  /**
   * Log System Events
   */
  async logSystemEvent(
    action: 'deadline_check' | 'alert_sent' | 'backup_created' | 'maintenance' | 'error',
    details: {
      metadata?: Record<string, any>;
      errorMessage?: string;
    } = {},
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info',
    result: 'success' | 'failure' = 'success'
  ): Promise<void> {
    await this.log({
      action: `system_${action}`,
      userId: 'system',
      userRole: 'system',
      timestamp: new Date(),
      resourceType: 'system',
      details: {
        metadata: details.metadata,
        after: { errorMessage: details.errorMessage }
      },
      severity,
      result
    });
  }

  /**
   * Log Security Events
   */
  async logSecurityEvent(
    action: 'unauthorized_access' | 'permission_denied' | 'suspicious_activity' | 'rate_limit_exceeded',
    userId?: string,
    userRole?: string,
    details: {
      resourceType?: string;
      resourceId?: string;
      reason?: string;
      metadata?: Record<string, any>;
    } = {},
    requestInfo?: { ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<void> {
    await this.log({
      action: `security_${action}`,
      userId: userId || 'unknown',
      userRole: userRole || 'unknown',
      timestamp: new Date(),
      resourceType: (details.resourceType as any) || 'system',
      resourceId: details.resourceId,
      details: {
        metadata: {
          reason: details.reason,
          ...details.metadata
        }
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
      sessionId: requestInfo?.sessionId,
      severity: 'warning',
      result: 'failure'
    });
  }

  /**
   * Core logging method
   */
  private async log(entry: Omit<AuditLogEntry, 'id'>): Promise<void> {
    try {
      // Add unique ID and ensure timestamp is Date object
      const logEntry = {
        ...entry,
        id: this.generateLogId(),
        timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp)
      };

      // Store in database (you would implement this based on your database)
      await this.storeLog(logEntry);

      // Also log to console for development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUDIT] ${entry.severity.toUpperCase()}: ${entry.action}`, {
          userId: entry.userId,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          result: entry.result
        });
      }

      // Send critical alerts
      if (entry.severity === 'critical') {
        await this.sendCriticalAlert(logEntry);
      }

    } catch (error) {
      console.error('Failed to write audit log:', error);
      // In production, you might want to send this to a fallback logging system
    }
  }

  /**
   * Store log entry in database
   */
  private async storeLog(entry: AuditLogEntry): Promise<void> {
    // This would be implemented based on your database schema
    // For now, we'll just log it
    console.log(`[AUDIT LOG] ${entry.timestamp.toISOString()} - ${entry.action}:`, {
      userId: entry.userId,
      userRole: entry.userRole,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      severity: entry.severity,
      result: entry.result
    });
  }

  /**
   * Send critical alert
   */
  private async sendCriticalAlert(entry: AuditLogEntry): Promise<void> {
    // This would integrate with your alerting system
    console.error(`[CRITICAL AUDIT ALERT] ${entry.action} by ${entry.userId} (${entry.userRole})`);
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get severity level for action
   */
  private getActionSeverity(action: string): 'info' | 'warning' | 'error' | 'critical' {
    if (action.includes('delete') || action.includes('deactivate')) return 'warning';
    if (action.includes('error') || action.includes('failed')) return 'error';
    if (action.includes('critical') || action.includes('security')) return 'critical';
    return 'info';
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    severity?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<AuditLogEntry[]> {
    // This would query your database
    // For now, return empty array
    return [];
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();