import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

/**
 * Reusable field label component for consistent UI labeling
 * Use this component to maintain consistent label styling across the application
 *
 * @example
 * // Basic usage
 * <FieldLabel>Email Address</FieldLabel>
 * <Input placeholder="Enter email" />
 *
 * @example
 * // Required field
 * <FieldLabel required>Phone Number</FieldLabel>
 * <Input placeholder="Enter phone" />
 *
 * @example
 * // Optional field
 * <FieldLabel optional>Notes</FieldLabel>
 * <TextArea placeholder="Add notes" />
 *
 * @example
 * // Custom styling
 * <FieldLabel style={{ textTransform: 'uppercase' }}>Priority</FieldLabel>
 * <Select options={...} />
 *
 * @param {string} children - Label text content
 * @param {boolean} required - Shows asterisk (*) if true
 * @param {boolean} optional - Shows "(optional)" text if true
 * @param {string} className - Additional CSS classes
 * @param {React.CSSProperties} style - Additional inline styles
 */
const FieldLabel = ({
  children,
  required = false,
  optional = false,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`field-label ${className}`}
      style={{
        fontSize: '12px',
        fontWeight: 600,
        marginBottom: '4px',
        color: 'var(--c-fg)',
        ...style,
      }}
    >
      {children}
      {required && <span style={{ color: 'var(--c-fg)', marginLeft: '2px', fontWeight: 800 }} aria-label="required">*</span>}
      {optional && <span style={{ color: 'var(--c-fg-3)', marginLeft: '4px', fontWeight: 400 }}>(optional)</span>}
    </div>
  );
};

export default FieldLabel;