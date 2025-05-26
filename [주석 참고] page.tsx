"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Loading, Typography } from "@components";
import { Size } from "@components/Constants";
import { useDisclosure, useFetchApi } from "@hooks";
import { usePayInfoData } from "@libs";
import { caseDetailAtom } from "@stores";
import { getCompareWithToday } from "@utils/dateUtil";
import { phoneInquiry } from "@utils/flutterUtil";
import { useMutation } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import PayFail from "@app/my-case/PayFail";
import PayGroupItem from "@app/my-case/PayGroupItem";
import PaySuccess from "@app/my-case/PaySuccess";
import PayProceeding from "@app/my-case/PayProceeding";

type TIsSuccess = {
  seller: "" | "fail" | "success";
  buyer: "" | "fail" | "success";
};

export default function My_PR_006M() {
  const { fetchApi } = useFetchApi();
  const { isOpen, open, close } = useDisclosure();
  const { loanNo, regType, statCd } = useAtomValue(caseDetailAtom);
  const { seller, buyer, refetch, execDt, masterStatCd } = usePayInfoData({ loanNo });
  const router = useRouter();
  const [failMsg, setFailMsg] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<TIsSuccess>({
    seller: "",
    buyer: "",
  });

  // 대출금(차주/매도인) 지급 요청
  const {
    mutate: requestAllPayment,
    data,
    isPending,
  } = useMutation({
    mutationKey: ["request-all-payment", loanNo],
    mutationFn: () =>
      fetchApi({
        url: `${process.env.NEXT_PUBLIC_APP_WOORI_API_URL}/api/cntr/SlrDbtrPayReq?loanNo=${loanNo}`,
        method: "post",
      }).then((res) => res.json()),
    gcTime: Infinity,
    onSuccess: (res) => {
      if (res.code !== "00") {
        setFailMsg(res.msg);
        open();
      }

      // 상환 정보 조회
      refetch();
    },
    onError: (error) => {
      console.log("error", error);
    },
  });

  // 차주 지급금 요청
  const { mutate: requestBuyerPayment, isPending: requestBuyerPending } =
    useMutation({
      mutationKey: ["request-buyer-payment"],
      mutationFn: () =>
        fetchApi({
          url: `${process.env.NEXT_PUBLIC_APP_WOORI_API_URL}/api/cntr/ByerPayReq?loanNo=${loanNo}`,
          method: "post",
        }).then((res) => res.json()),
      onSuccess: (res) => {
        if (res.code !== "00") {
          setFailMsg(res.msg);
          open();
        }

        // 상환 정보 조회
        refetch();
      },
      onError: (error) => {
        console.log("error", error);
      },
    });

  // 매도인 지급금 요청
  const { mutate: requestSellerPayment, isPending: requestSellerPending } =
    useMutation({
      mutationKey: ["request-seller-payment"],
      mutationFn: () =>
        fetchApi({
          url: `${process.env.NEXT_PUBLIC_APP_WOORI_API_URL}/api/cntr/SlrPayReq?loanNo=${loanNo}`,
          method: "post",
        }).then((res) => res.json()),

      onSuccess: (res) => {
        if (res.code !== "00") {
          setFailMsg(res.msg);
          open();
        }

        // 상환 정보 조회
        refetch();
      },
      onError: (error) => {
        console.log("error", error);
      },
    });

  const isAllPass = Object.values(isSuccess).every((el) => el === "success");
  const isAllFail = Object.values(isSuccess).every((el) => el === "fail");

  const makeIsProgressing = () => setIsSuccess({ seller: "", buyer: "" });

  useEffect(() => {
    if (statCd === "12" && loanNo !== "" && !isPending) {
      makeIsProgressing();
      requestAllPayment();
      return;
    }
  }, [statCd, loanNo]);

  useEffect(() => {
    setIsSuccess({
      seller:
        seller?.statCd === "02"
          ? "success"
          : seller?.statCd === "91" ||
            seller?.statCd === "92" ||
            seller?.statCd === "93" ||
            seller?.statCd === "94" ||
            seller?.statCd === "99" ||
            seller?.statCd.length === 3 //은행 오류 응답코드(3자리)일 경우 실패
          ? "fail"
          : "",
      buyer:
        buyer?.statCd === "02"
          ? "success"
          : buyer?.statCd === "91" ||
            buyer?.statCd === "92" ||
            buyer?.statCd === "93" ||
            buyer?.statCd === "94" ||
            buyer?.statCd === "99" ||
            buyer?.statCd.length === 3 //은행 오류 응답코드(3자리)일 경우 실패
          ? "fail"
          : "",
    });
  }, [seller, buyer]);

  // /* 25.05.02 이전페이지에서 requestAllPayment로 페이지 이동 후 isSuccess 감지 하여 실패케이스가 한건이라도 있으면 오류 팝업 뜨게 */
  useEffect(() => {
    if (isSuccess.seller === "fail" || isSuccess.buyer === "fail") {
      if (isSuccess.seller === "fail") {
        setFailMsg(
          `[실패코드 : ${seller?.errCd}] 대출금을 다시 요청하기 위해\n 고객센터(1877-2495)로 문의해주세요.`
        );
      } else if (isSuccess.buyer === "fail") {
        setFailMsg(
          `[실패코드 : ${buyer?.errCd}] 대출금을 다시 요청하기 위해\n 고객센터(1877-2495)로 문의해주세요.`
        );
      }
      open(); // 한 번만 호출됨
    }
  }, [isSuccess]);

  // 대출실행일이 현재보다 과거이면 true, 같거나 미래이면 false
  const isPast = getCompareWithToday(execDt) === "past";

  console.log("masterStatCd", masterStatCd);

  return (
    <>
      {(requestSellerPending || requestBuyerPending || isPending) && (
        <Loading />
      )}
      <div className="flex flex-col justify-between grow w-full h-full">
        <div>
          <Typography
            type={Typography.TypographyType.H1}
            color="text-kos-gray-800"
          >
            대출금 지급 결과를
            <br />
            확인해주세요
          </Typography>
          {
            <div className="flex justify-end p-2">
              {!isAllPass && (
                //25.05.19 다시 불러오기 버튼 임시 표시
                <Button.CtaButton
                  size="Small"
                  state="None"
                  onClick={() => refetch()}
                >
                  다시 불러오기
                </Button.CtaButton>
              )}
            </div>
          }
          <div className="w-full flex flex-col gap-y-3">
            {seller?.payAmt !== undefined && seller?.payAmt > 0 && (
              <PayGroupItem
                label="매도인"
                payAmt={seller?.payAmt}
                containerClassName="pt-6"
              >
                {isSuccess.seller === "" ? (
                  // <p></p> // 지급 요청중 문구 삭제
                  // 25.05.19 지급 요청 중 문구 임시 표시
                  <PayProceeding text="지급 요청 중" />
                ) : (
                  !isAllFail &&
                  (isSuccess.seller === "success" ? (
                    <PaySuccess />
                  ) : (
                    <div className="flex justify-between">
                      <PayFail errCd={seller?.errCd} />
                      <Button.CtaButton
                        size={Size.Small}
                        state={"Default"}
                        disabled={isPast}
                        onClick={() => {
                          makeIsProgressing();
                          requestSellerPayment();
                        }}
                      >
                        다시 요청하기
                      </Button.CtaButton>
                    </div>
                  ))
                )}
              </PayGroupItem>
            )}
            {!isAllFail && <hr className="-mx-4 my-6" />}
            {buyer?.payAmt !== undefined && buyer?.payAmt > 0 && (
              <PayGroupItem
                containerClassName="pb-6"
                label="차주"
                payAmt={buyer?.payAmt}
              >
                {isSuccess.buyer === "" ? (
                  // <p></p> // 지급 요청중 문구 삭제
                  // 25.05.19 지급요청 중 문구 임시 표시
                  <PayProceeding text="지급 요청 중" />
                ) : isAllFail ? (
                  <div className="flex justify-between">
                    <PayFail errCd={buyer?.errCd ?? seller?.errCd} />
                    <Button.CtaButton
                      size={Size.Small}
                      state={"Default"}
                      disabled={isPast}
                      onClick={() => {
                        makeIsProgressing();
                        requestAllPayment();
                      }}
                    >
                      다시 요청하기
                    </Button.CtaButton>
                  </div>
                ) : isSuccess.buyer === "success" ? (
                  <PaySuccess />
                ) : (
                  <div className="flex justify-between">
                    <PayFail errCd={buyer?.errCd} />
                    <Button.CtaButton
                      size={Size.Small}
                      disabled={isPast}
                      state={"Default"}
                      onClick={() => {
                        makeIsProgressing();
                        requestBuyerPayment();
                      }}
                    >
                      다시 요청하기
                    </Button.CtaButton>
                  </div>
                )}
              </PayGroupItem>
            )}
          </div>
        </div>
        {!isPast && (
          <footer>
            <Button.CtaButton
              size={Size.XLarge}
              state={"On"}
              disabled={!isAllPass}
              onClick={() =>
                router.push(`/my-case/cntr/${loanNo}?regType=${regType}`)
              }
            >
              확인
            </Button.CtaButton>
          </footer>
        )}
        <Alert
          isOpen={isOpen}
          title={"지급 실패건이 있습니다"}
          confirmText={"문의하기"}
          confirmCallBack={() => phoneInquiry()}
          cancelText={"닫기"}
          cancelCallBack={close}
          bodyText={failMsg}
        />
      </div>
    </>
  );
}
