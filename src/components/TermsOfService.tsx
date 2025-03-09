import React from 'react';
import { format } from 'date-fns';

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
      <div className="prose max-w-none space-y-6 text-gray-600">
        <p className="text-sm text-gray-500">Last updated: February 1, 2025</p>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing or using mineoppskrifter.netlify.app ("the Application"), you agree to be bound by these Terms of Service. 
            If you do not agree, please do not use the Application.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Use of the Application</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>The Application allows users to create, store, and share recipes</li>
            <li>Users are responsible for the content they submit and must ensure it does not violate any laws or third-party rights</li>
            <li>The Application is provided "as is" without any warranties</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. User Responsibilities</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Users must not submit offensive, harmful, or illegal content</li>
            <li>Users retain ownership of their submitted recipes but grant the Application a non-exclusive license to display and store the content</li>
            <li>Users are responsible for maintaining the security of their accounts and data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Privacy and Data Handling</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Data collected from users is managed according to our Privacy Policy</li>
            <li>We do not sell user data to third parties</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Limitation of Liability</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>We are not responsible for any losses or damages arising from the use of the Application</li>
            <li>Users assume full responsibility for any issues that arise from sharing or using submitted content</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Service Availability</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>We do not guarantee uninterrupted access to the Application and may modify or discontinue services at any time</li>
            <li>We are not liable for any data loss due to maintenance, updates, or unforeseen technical issues</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Third-Party Links and Services</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>The Application may contain links to third-party websites or services that are not controlled by us</li>
            <li>We are not responsible for the content, policies, or practices of these external sites</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Intellectual Property</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>All branding, trademarks, and original content on the Application remain the property of the Application owner</li>
            <li>Users may not reproduce, distribute, or modify any part of the Application without prior consent</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Dispute Resolution</h2>
          <p>
            Any disputes arising from the use of the Application shall first be attempted to be resolved through informal negotiations.
            If necessary, disputes shall be handled through arbitration or legal proceedings in accordance with the governing law specified below.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Governing Law</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>These Terms are governed by and construed in accordance with the laws of Norwegian Law</li>
            <li>Any disputes shall be subject to the exclusive jurisdiction of the courts in Stavanger</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Age Restrictions</h2>
          <p>Users under the age of 18 must have parental or guardian consent to use the Application.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Termination</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>We reserve the right to terminate or suspend access to the Application for any user who violates these Terms</li>
            <li>Users can request the deletion of their accounts and associated data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">13. Modifications to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Application after changes indicates acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">14. Contact Information</h2>
          <p>
            For questions regarding these Terms, please contact us at{' '}
            <a href="mailto:oppskrifter@persline.com" className="text-indigo-600 hover:text-indigo-500">
              oppskrifter@persline.com
            </a>
          </p>
        </section>

        <p className="mt-8 text-sm text-gray-500">
          By using mineoppskrifter.netlify.app, you acknowledge and agree to these Terms of Service.
        </p>
      </div>
    </div>
  );
}