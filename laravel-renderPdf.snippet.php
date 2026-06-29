<?php

/*
 * Drop-in replacement for renderPdf() in
 * app/Services/SqaafQuarterlyReport.php.
 *
 * It sends the already-built report HTML to the Node PDF microservice and
 * returns the PDF bytes — no local browser, FreeType, or crashpad involved.
 *
 * Requires in .env:
 *   REPORT_SERVICE_URL="https://sqaaf-report-pdf.onrender.com"
 *   REPORT_SERVICE_KEY="<secret shared with the service>"
 *
 * Add at the top of the file if not already imported:
 *   use Illuminate\Support\Facades\Http;
 */

private function renderPdf(string $html): string
{
    $endpoint = rtrim((string) env('REPORT_SERVICE_URL', ''), '/');
    if ($endpoint === '') {
        abort(500, 'REPORT_SERVICE_URL is not set. Point it at the Node PDF service.');
    }

    try {
        $response = Http::timeout((int) env('REPORT_SERVICE_TIMEOUT', 120))
            ->withHeaders(['X-Api-Key' => (string) env('REPORT_SERVICE_KEY', '')])
            ->acceptJson()
            ->post($endpoint . '/render', ['html' => $html]);
    } catch (\Throwable $e) {
        abort(500, 'Could not reach the report PDF service: ' . $e->getMessage());
    }

    if (!$response->successful()) {
        abort(500, 'Report PDF service failed (HTTP ' . $response->status() . '): ' . $response->body());
    }

    $pdf = $response->body();
    if ($pdf === '' || strncmp($pdf, '%PDF', 4) !== 0) {
        abort(500, 'Report PDF service returned an invalid PDF.');
    }

    return $pdf;
}
