import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }

    // Check if user is admin
    const adminRes = await db.query('SELECT role FROM profiles WHERE id = $1', [decoded.userId])
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get all approved leave requests
    const result = await db.query(`
      SELECT
        lr.id,
        lr.start_date,
        lr.end_date,
        lr.days,
        lr.reason,
        lr.created_at,
        lr.approved_at,
        p.first_name,
        p.last_name,
        p.email,
        p.position,
        (p.first_name || ' ' || p.last_name) as full_name
      FROM leave_requests lr
      JOIN profiles p ON lr.user_id = p.id
      WHERE lr.status = 'approved'
      ORDER BY lr.start_date DESC, p.first_name ASC
    `)

    // Transform data for Excel
    const excelData = result.rows.map((row: any) => ({
      'Employee Name': row.full_name,
      'Email': row.email,
      'Position': row.position ? row.position.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'N/A',
      'Start Date': new Date(row.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      'End Date': new Date(row.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      'Days': row.days,
      'Reason': row.reason || 'N/A',
      'Requested On': new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      'Approved On': row.approved_at ? new Date(row.approved_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'
    }))

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Employee Name
      { wch: 30 }, // Email
      { wch: 15 }, // Position
      { wch: 15 }, // Start Date
      { wch: 15 }, // End Date
      { wch: 8 },  // Days
      { wch: 30 }, // Reason
      { wch: 15 }, // Requested On
      { wch: 15 }  // Approved On
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved Leave')

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return the Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="approved-leave-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
  } catch (error) {
    console.error('Error exporting leave data:', error)
    return NextResponse.json({ error: 'Failed to export leave data' }, { status: 500 })
  }
}

