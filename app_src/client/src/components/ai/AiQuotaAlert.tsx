import React, { useState } from 'react';
import { AlertCircle, Phone, X } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';

interface AiQuotaAlertProps {
  contactPhone?: string;
  className?: string;
}

const AiQuotaAlert: React.FC<AiQuotaAlertProps> = ({
  contactPhone = '400-888-8888',
  className = '',
}) => {
  const [showContact, setShowContact] = useState(false);

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            AI 能力暂不可用，请联系服务商开通后使用
          </p>
          <p className="text-xs text-amber-700 mt-1">
            当前 AI 服务暂时无法响应，开通后即可正常使用。
          </p>
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
              onClick={() => setShowContact(true)}
            >
              <Phone className="w-4 h-4 mr-1.5" />
              联系服务商
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showContact} onOpenChange={setShowContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>联系服务商</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <Phone className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">客服电话</p>
                <p className="text-base font-semibold text-gray-900">
                  {contactPhone}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              工作时间：周一至周五 9:00 - 18:00
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AiQuotaAlert;
