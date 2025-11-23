import fs from 'fs';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import { supabase } from '../config/supabase.js';

export const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        fs.unlinkSync(filePath); // Clean up
        resolve(results);
      })
      .on('error', (error) => {
        fs.unlinkSync(filePath);
        reject(error);
      });
  });
};

export const parseExcel = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  fs.unlinkSync(filePath); // Clean up
  return data;
};

export const importLeads = async (campaignId, data, fieldMapping) => {
  const leads = [];
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    try {
      // Map fields from CSV/Excel to our schema
      const lead = {
        campaign_id: campaignId,
        phone: normalizePhone(row[fieldMapping.phone] || row.phone || row.Phone || row.PHONE),
        first_name: row[fieldMapping.firstName] || row.firstName || row.first_name || row.FirstName || row['First Name'] || '',
        last_name: row[fieldMapping.lastName] || row.lastName || row.last_name || row.LastName || row['Last Name'] || '',
        email: row[fieldMapping.email] || row.email || row.Email || row.EMAIL || null,
        alt_phone: row[fieldMapping.altPhone] || row.altPhone || row.alt_phone || row['Alt Phone'] || null,
        address: {
          street: row[fieldMapping.street] || row.street || row.Street || row.address || '',
          city: row[fieldMapping.city] || row.city || row.City || '',
          state: row[fieldMapping.state] || row.state || row.State || row.province || '',
          zipCode: row[fieldMapping.zipCode] || row.zipCode || row.zip || row.Zip || '',
        },
        custom_fields: {},
        status: 'new',
        priority: parseInt(row.priority) || 0,
      };

      // Validate phone number
      if (!lead.phone) {
        errors.push({ row: i + 1, error: 'Missing phone number' });
        continue;
      }

      // Add any unmapped fields to custom_fields
      const mappedFields = ['phone', 'firstName', 'lastName', 'email', 'altPhone', 'street', 'city', 'state', 'zipCode', 'priority'];
      Object.keys(row).forEach(key => {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
        if (!mappedFields.some(f => normalizedKey.includes(f.toLowerCase()))) {
          lead.custom_fields[key] = row[key];
        }
      });

      leads.push(lead);
    } catch (error) {
      errors.push({ row: i + 1, error: error.message });
    }
  }

  // Batch insert leads
  if (leads.length > 0) {
    const { data: insertedLeads, error } = await supabase
      .from('leads')
      .insert(leads)
      .select('id');

    if (error) {
      throw error;
    }

    return {
      imported: insertedLeads.length,
      errors: errors,
      total: data.length,
    };
  }

  return {
    imported: 0,
    errors: errors,
    total: data.length,
  };
};

const normalizePhone = (phone) => {
  if (!phone) return null;

  // Convert to string and remove all non-numeric characters except +
  let normalized = String(phone).replace(/[^\d+]/g, '');

  // Handle Philippine numbers
  if (normalized.startsWith('0')) {
    normalized = '+63' + normalized.substring(1);
  } else if (normalized.startsWith('63') && !normalized.startsWith('+')) {
    normalized = '+' + normalized;
  } else if (!normalized.startsWith('+') && normalized.length === 10) {
    normalized = '+63' + normalized;
  }

  return normalized;
};
